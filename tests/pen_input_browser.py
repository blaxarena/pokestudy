"""Canvas input ownership/palm rejection using pen and touch Pointer Events.
Chromium iPad emulation; not an Apple Pencil/Safari hardware certification.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/';sprite=(root/'tests/fixtures/bulbasaur.png').read_bytes()
def api(route):
 if 'generation/' in route.request.url:data={'pokemon_species':[{'url':'https://pokeapi.co/api/v2/pokemon-species/1/'}]}
 else:data={'id':1,'names':[{'language':{'name':'ko'},'name':'윈디'}]}
 route.fulfill(json=data)
def pointer(page,kind,pointer_id,event,x,y,canvas='writeInk'):
 page.evaluate('''([kind,id,event,x,y,canvas])=>{
  const c=document.getElementById(canvas),b=c.getBoundingClientRect();
  c.dispatchEvent(new PointerEvent(event,{bubbles:true,cancelable:true,pointerId:id,pointerType:kind,isPrimary:true,button:0,buttons:event==='pointerup'?0:1,clientX:b.left+x,clientY:b.top+y,pressure:.6}));
 }''',[kind,pointer_id,event,x,y,canvas])
def draw(page,kind,pointer_id,y,canvas='writeInk'):
 pointer(page,kind,pointer_id,'pointerdown',20,y,canvas);pointer(page,kind,pointer_id,'pointermove',100,y,canvas);pointer(page,kind,pointer_id,'pointerup',100,y,canvas)
def signature(page,canvas='writeInk'):
 return page.evaluate("id=>Array.from(document.getElementById(id).getContext('2d').getImageData(0,0,document.getElementById(id).width,document.getElementById(id).height).data).reduce((a,v,i)=>(a+v*(i%13+1))%1000000007,0)",canvas)
def alpha(page,x,y):
 return page.evaluate("([x,y])=>{const c=document.querySelector('#writeInk'),b=c.getBoundingClientRect();return c.getContext('2d').getImageData(Math.round(x*c.width/b.width),Math.round(y*c.height/b.height),1,1).data[3]}",[x,y])
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1194,'height':834},is_mobile=True,has_touch=True)
 context.route('https://pokeapi.co/**',api);context.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(body=sprite,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'}))
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'?v=20261110-pen-guide');page.wait_for_function("!document.querySelector('#startWriting').disabled")
 page.evaluate("async()=>{const m=await import('./src/modules/capture/store.js');await m.startWriting([{id:1,name:'윈디',gen:1,image:'https://raw.githubusercontent.com/fixture/1.png',fallback:'https://raw.githubusercontent.com/fixture/1.png'}]);}")
 page.reload();page.wait_for_function("!document.querySelector('#startWriting').disabled");page.locator('[data-module=writeModule]').click();page.wait_for_selector('#writeStrokeGuide svg');page.locator('#writeInk').scroll_into_view_if_needed()
 assert page.locator('meta[name=app-version]').get_attribute('content')=='2026-11-10-pen-guide'
 assert page.locator('#writeStrokeGuide [data-stroke-number]').count()==8
 assert page.locator('#writePlayStrokes').is_visible()
 draw(page,'touch',10,40);assert signature(page)>0
 page.locator('#writeClear').click();assert signature(page)==0
 # A pen takes over a currently active palm/finger and removes that transient mark.
 pointer(page,'touch',10,'pointerdown',20,40);pointer(page,'touch',10,'pointermove',100,40);assert alpha(page,60,40)>0
 pointer(page,'pen',20,'pointerdown',20,100);assert alpha(page,60,40)==0
 pointer(page,'pen',20,'pointermove',80,100)
 pointer(page,'touch',10,'pointermove',150,40);pointer(page,'touch',10,'pointerup',150,40)
 pointer(page,'pen',20,'pointermove',120,100);pointer(page,'pen',20,'pointerup',120,100)
 assert alpha(page,60,100)>0 and alpha(page,60,40)==0 and alpha(page,110,100)>0
 assert '펜을 감지' in page.locator('#writeInputStatus').inner_text()
 print('PASS pen takeover rolls back palm marks; foreign-pointer movement/up cannot corrupt or end a pen stroke')
 before=signature(page);draw(page,'touch',30,200);draw(page,'mouse',40,240);assert signature(page)==before
 draw(page,'pen',21,160);assert signature(page)!=before
 page.locator('#writeUndo').click();assert signature(page)==before
 print('PASS automatic pen lock blocks finger/mouse while pen drawing and undo still work')
 page.locator('#writeInputMode').select_option('all');draw(page,'touch',31,220);assert signature(page)!=before
 page.locator('#writeInputMode').select_option('pen');page.reload();page.wait_for_function("!document.querySelector('#startWriting').disabled");page.locator('[data-module=writeModule]').click();page.wait_for_selector('#writeStrokeGuide svg');page.locator('#writeClear').click()
 assert page.locator('#writeInputMode').input_value()=='pen'
 draw(page,'touch',32,40);assert signature(page)==0;draw(page,'pen',22,100);assert signature(page)>0
 print('PASS all-input opt-out, saved pen-only setting, and rejection before first pen on reload')
 # Normal buttons remain finger accessible. The preference also protects coloring.
 page.locator('[data-module=colorModule]').tap();assert page.locator('#colorInputMode').input_value()=='pen'
 page.locator('#loadColorPool').click();page.wait_for_function("document.querySelector('#colorReference').naturalWidth>0")
 page.locator('#colorClear').click();assert signature(page,'colorInk')==0
 draw(page,'touch',33,80,'colorInk');assert signature(page,'colorInk')==0
 draw(page,'pen',23,80,'colorInk');assert signature(page,'colorInk')>0
 page.locator('#colorInputMode').select_option('all');page.locator('[data-module=writeModule]').tap();assert page.locator('#writeInputMode').input_value()=='all'
 page.locator('.write-pad-wrap').screenshot(path='/tmp/pokestudy-ipad-pen-guide.png')
 print('PASS normal controls stay touch accessible; coloring and handwriting share the drawing-only preference')
 page.locator('#writeInputMode').select_option('pen')
 page.locator('#writeClear').click();page.locator('#writeInk').scroll_into_view_if_needed();box=page.locator('#writeInk').bounding_box();cdp=context.new_cdp_session(page)
 x=box['x']+30;y=box['y']+80
 cdp.send('Input.dispatchMouseEvent',{'type':'mouseMoved','x':x,'y':y,'pointerType':'pen'})
 cdp.send('Input.dispatchMouseEvent',{'type':'mousePressed','x':x,'y':y,'button':'left','buttons':1,'pointerType':'pen','force':.6})
 cdp.send('Input.dispatchMouseEvent',{'type':'mouseMoved','x':x+90,'y':y,'buttons':1,'pointerType':'pen','force':.6})
 cdp.send('Input.dispatchMouseEvent',{'type':'mouseReleased','x':x+90,'y':y,'button':'left','buttons':0,'pointerType':'pen'})
 assert signature(page)>0;before=signature(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y+90,'id':1}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+90,'y':y+90,'id':1}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert signature(page)==before
 cdp.send('Input.dispatchMouseEvent',{'type':'mouseMoved','x':0,'y':0,'pointerType':'mouse'})
 print('PASS browser-generated pen stroke draws while a real emulated touch swipe is blocked')
 assert not errors,errors
 browser.close();server.shutdown()
