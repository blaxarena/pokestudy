"""Sprite fallback, timeout, caching, request coalescing and stale scene tests."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import re,time,io
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/';sprite=(root/'tests/fixtures/bulbasaur.png').read_bytes()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context();page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 counts={};order=[];offline=False
 def api(route):
  url=route.request.url;id=int(re.search(r'/(\d+)/?$',url)[1]);counts[id]=counts.get(id,0)+1
  if offline or id==904:route.abort();return
  data={'sprites':{}} if id==902 else {'sprites':{'other':{'showdown':{'front_default':f'{base}fixture/{id}/broken.gif'}},'versions':{'generation-v':{'black-white':{'animated':{'front_default':f'{base}fixture/{id}/404.gif'}}}},'front_default':f'{base}fixture/{id}/good.png'}}
  route.fulfill(json=data)
 def image(route):
  url=route.request.url;order.append(url)
  if 'broken' in url:route.fulfill(body='not an image',content_type='image/gif')
  elif '404' in url:route.fulfill(status=404,body='missing')
  elif 'slow' in url:time.sleep(.15);route.fulfill(body=sprite,content_type='image/png')
  else:route.fulfill(body=sprite,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'})
 context.route('https://pokeapi.co/**',api);context.route('**/fixture/**',image)
 page.goto(base)
 r=page.evaluate('''async()=>{
  const m=await import('./src/modules/capture/sprites.js');
  const a=m.loadSprite({id:901,name:'테스트'}),b=m.loadSprite({id:901,name:'테스트'});
  if(a!==b)throw Error('not coalesced');const r=await a;
  if(!r.url.endsWith('good.png')||r.fallback)throw Error('candidate fallback');return r;
 }''')
 assert counts[901]==1 and ['broken.gif','404.gif','good.png']==[u.rsplit('/',1)[1] for u in order if '/901/' in u]
 assert r['bounds']['w']<1 and r['bounds']['h']<1
 print('PASS broken/decode failure and 404 fall through in order; duplicate requests coalesce; transparent bounds measured')
 image_buffer=io.BytesIO();frame=Image.open(root/'tests/fixtures/bulbasaur.png').convert('RGBA');frame.save(image_buffer,format='GIF',save_all=True,append_images=[frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)],duration=100,loop=0)
 page.route('https://pokeapi.co/api/v2/pokemon/910/',lambda r:r.fulfill(json={'sprites':{'other':{'showdown':{'front_default':base+'fixture/910/animation.gif'}}}}))
 page.route('**/fixture/910/animation.gif',lambda r:r.fulfill(body=image_buffer.getvalue(),content_type='image/gif'))
 r=page.evaluate("async()=>await (await import('./src/modules/capture/sprites.js')).loadSprite({id:910,name:'애니메이션'})")
 assert r['url'].endswith('animation.gif') and not r['fallback']
 print('PASS animated GIF candidate decodes and is selected in normal motion')
 r=page.evaluate("async()=>await (await import('./src/modules/capture/sprites.js')).loadSprite({id:902,name:'필드 없음'})")
 assert r['fallback'] and r['url'].endswith('fallback.svg')
 r=page.evaluate("async()=>await (await import('./src/modules/capture/sprites.js')).loadSprite({id:904,name:'API 실패'})")
 assert r['fallback'];print('PASS missing API fields and offline API use built-in fallback')
 # Static candidates lead with reduced motion, even if an animation exists.
 r=page.evaluate("async()=>await (await import('./src/modules/capture/sprites.js')).loadSprite({id:905,name:'정지'},true)")
 assert r['url'].endswith('good.png') and not any('/905/broken' in u for u in order)
 r=page.evaluate("async()=>{const m=await import('./src/modules/capture/sprites.js');try{await m.loadImage('fixture/slow.png',20);return false}catch{return true}}")
 assert r;print('PASS reduced motion static sprite priority and image load timeout')
 stalled=[];page.route('https://pokeapi.co/api/v2/pokemon/908/',lambda r:stalled.append(r))
 started=time.monotonic();r=page.evaluate("async()=>await (await import('./src/modules/capture/sprites.js')).loadSprite({id:908,name:'API 시간 초과'})")
 assert r['fallback'] and time.monotonic()-started>=2
 for request in stalled:request.abort()
 page.unroute('https://pokeapi.co/api/v2/pokemon/908/')
 print('PASS stalled API times out and starts with built-in fallback')
 offline=True;page.reload()
 r=page.evaluate("async()=>await (await import('./src/modules/capture/sprites.js')).loadSprite({id:901,name:'캐시'})")
 assert not r['fallback'] and r['url'].endswith('good.png')
 assert counts[901]==2;print('PASS ID response and successful candidate persist across reload with API offline')
 # Hold an image while switching modules: the old response cannot steal a new scene.
 offline=False
 page.evaluate('''async()=>{const m=await import('./src/modules/capture/store.js');await m.transact(s=>{s.balances.normal=2;s.writing={questions:[{id:906,name:'새 대상'}]};s.encounter={id:'old',pokemon:{id:907,name:'이전 대상'},misses:0,first:true,seed:0,result:null};});}''')
 held=[];page.route('**/fixture/907/**',lambda r:held.append(r))
 with page.expect_request('**/fixture/907/broken.gif'):
  page.locator('[data-module=captureModule]').click()
 page.locator('#captureWrite').click()
 page.evaluate('''async()=>{const m=await import('./src/modules/capture/store.js');await m.transact(s=>{s.encounter={id:'new',pokemon:{id:906,name:'새 대상'},misses:0,first:true,seed:0,result:null};});}''')
 page.locator('[data-module=captureModule]').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='ready'")
 for request in held:request.fulfill(body=sprite,content_type='image/png')
 page.wait_for_timeout(100)
 assert page.locator('#captureName').inner_text()=='새 대상'
 print('PASS late sprite response after navigation cannot overwrite the current encounter')
 assert not errors,errors
 context.close();browser.close();server.shutdown()
