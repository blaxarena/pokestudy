"""Checks exact editor/game composition and real sprite-alpha occlusion.
Uses local HTTP and intercepted Pokemon fixtures, not live API data.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import json,base64,io
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root.parent)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/{root.name}/';sprite=(root/'tests/fixtures/bulbasaur.png').read_bytes()
with sync_playwright() as pw,TemporaryDirectory() as tmp:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1280,'height':900});page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'editor/');page.wait_for_function("!document.querySelector('#saveJson').disabled");page.locator('#loadJson').set_input_files(root/'public/assets/forest/scene-01/forest-layout.json');page.wait_for_function("document.querySelector('#layerList').children.length===49")
 with page.expect_download() as d:page.locator('#savePng').click()
 expected=Path(tmp)/'editor.png';d.value.save_as(expected)
 page.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(body=sprite,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'}))
 page.add_init_script('''window.sceneDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(this.canvas.id==='hideScene')window.sceneDraws.push({image,src:image.src,args});return draw.call(this,image,...args)};''')
 page.goto(base+'?play=forest');page.wait_for_selector('#hideModule:not(.hidden)')
 page.evaluate('''localStorage.setItem('pokedexHiddenCandidatesV1',JSON.stringify(Array.from({length:60},(_,i)=>({id:i+1,name:'테스트'+(i+1),types:['grass'],image:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i+1}.png`,fallback:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i+1}.png`}))));''')
 rendered=page.evaluate('''async()=>{const m=await import(new URL('./src/modules/hidden-picture/layout-scene.js',location.href));const s=await m.loadLayoutScene(new URL('./public/assets/forest/scene-01/scene-layout-v1.json',location.href).href);const c=document.createElement('canvas');c.width=1672;c.height=941;m.paintLayoutScene(c.getContext('2d'),s,[],new Map(),1672,941);return c.toDataURL().split(',')[1]}''')
 with Image.open(expected) as original,Image.open(io.BytesIO(base64.b64decode(rendered))) as actual:
  difference=ImageChops.difference(original.convert('RGB'),actual.convert('RGB'))
  if difference.getbbox():
   original.save('/tmp/forest-editor-expected.png');actual.save('/tmp/forest-game-actual.png');print('Pixel comparison bounds:',difference.getbbox(),'range:',difference.getextrema(),flush=True)
  assert difference.getbbox() is None
 print('PASS uploaded 49-object composition: game scenery equals editor export pixel for pixel',flush=True)
 for level,count,body_limit,head_limit in [('easy',12,.22,.12),('normal',25,.32,.18),('hard',45,.42,.22)]:
  page.locator(f'[data-level={level}]').click();page.evaluate('window.sceneDraws=[]');page.locator('#hideStartBtn').click();page.wait_for_selector('#hideGame:not(.hidden)')
  report=page.evaluate('''async()=>{
   const m=await import(new URL('./src/modules/hidden-picture/layout-scene.js',location.href));const o=await import(new URL('./src/modules/hidden-picture/occlusion.js',location.href));const s=await m.loadLayoutScene(new URL('./public/assets/forest/scene-01/scene-layout-v1.json',location.href).href);
   const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d',{willReadFrequently:true});let depth=0;const results=[],paths=[];
   for(const d of window.sceneDraws){if(d.args.length===8){depth++;paths.push(d.src);continue;}if(!d.src.includes('raw.githubusercontent.com'))continue;ctx.clearRect(0,0,48,48);ctx.drawImage(d.image,0,0,48,48);const points=o.spriteSamples(ctx.getImageData(0,0,48,48));const [x,y,w,h]=d.args;results.push(o.measureOcclusion(points,{x,y,w,h},s.foregroundMasks.masks[depth],418,235,1672,941));}
   return {results,paths,expectedPaths:s.objects.map(object=>new URL(object.metadata.file,new URL('./asset-packages/forest-01/manifest.json',location.href)).href)};
  }''')
  assert report['paths']==report['expectedPaths'],'User object order changed'
  assert len(report['results'])==count
  assert max(r['body'] for r in report['results'])<=body_limit+1e-9
  assert max(r['head'] for r in report['results'])<=head_limit+1e-9
  hidden=sum(r['body']>.02 for r in report['results']);assert hidden>0
  print(f'PASS {level}: 49 objects ordered, {hidden}/{count} partially hidden, max sprite occlusion {max(r["body"] for r in report["results"]):.3f}, max upper-feature occlusion {max(r["head"] for r in report["results"]):.3f}',flush=True)
  page.locator('#hideBackBtn').click()
 assert not errors,errors;b.close()
server.shutdown()
