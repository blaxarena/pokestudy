"""Real Chromium: numbered Hangul guides, animation, export, and blank-work isolation."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from tempfile import TemporaryDirectory
from PIL import Image
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)));Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/';sprite=(root/'tests/fixtures/bulbasaur.png').read_bytes()
names={1:'피카츄',2:'이상해씨',3:'폴리곤2'}
def api(route):
 url=route.request.url
 if 'generation/' in url:data={'pokemon_species':[{'url':f'https://pokeapi.co/api/v2/pokemon-species/{i}/'} for i in names]}
 else:
  i=int(re.search(r'pokemon-species/(\d+)',url)[1]);data={'id':i,'names':[{'language':{'name':'ko'},'name':names[i]}]}
 route.fulfill(json=data)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844});context.route('https://pokeapi.co/**',api);context.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(body=sprite,content_type='image/png'))
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));requests=[];page.on('request',lambda r:requests.append(r.url))
 page.goto(base);page.wait_for_function("!document.querySelector('#startWriting').disabled")
 # Use a fixed saved session so the first displayed name is deterministic.
 page.evaluate("async()=>{const m=await import('./src/modules/capture/store.js');await m.startWriting([{id:1,name:'피카츄',gen:1,image:'https://raw.githubusercontent.com/fixture/1.png',fallback:'https://raw.githubusercontent.com/fixture/1.png'},{id:3,name:'폴리곤2',gen:1,image:'https://raw.githubusercontent.com/fixture/3.png',fallback:'https://raw.githubusercontent.com/fixture/3.png'}]);}")
 page.reload();page.wait_for_function("!document.querySelector('#startWriting').disabled");page.locator('[data-module=writeModule]').click()
 page.wait_for_selector('#writeStrokeGuide svg');assert page.locator('#writeStrokeGuide [data-stroke-number]').count()==16
 assert page.locator('#writeStrokeLetters button').all_text_contents()==['피','카','츄']
 assert not page.locator('#writeGuideText').is_visible()
 page.locator('#writeNext').click();assert '먼저 써' in page.locator('#writeSaveError').inner_text()
 assert page.locator('#writeInk').evaluate("c=>!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)")
 print('PASS numbered composed guide does not add ink, complete work, or award balls')
 page.locator('#writeStrokeDetails summary').click();page.locator('#writeStrokeLetters button').filter(has_text='카').click()
 assert page.locator('#writeStrokeZoom [data-stroke-number]').count()==4
 page.locator('#writeZoomStepStroke').click();assert page.locator('#writeStrokeStatus').inner_text()=='카 · 1/4획'
 page.locator('#writeStepStroke').click();assert page.locator('#writeStrokeStatus').inner_text()=='카 · 2/4획'
 page.clock.install();page.locator('#writeZoomPlayStrokes').click();page.clock.run_for(500)
 assert page.locator('#writeStrokeZoom [data-stroke="1"]').get_attribute('visibility')=='visible'
 offset=float(page.locator('#writeStrokeZoom [data-stroke="1"]').evaluate('e=>e.style.strokeDashoffset'));assert offset>0
 page.clock.run_for(3500);assert '다 봤어요' in page.locator('#writeStrokeStatus').inner_text()
 page.locator('#writeStrokeDetails').screenshot(path='/tmp/pokestudy-stroke-zoom.png')
 print('PASS per-letter zoom, local playback controls, sequential stepping, progressive stroke animation and completion')
 page.locator('#writeShowStrokeOrder').uncheck();assert page.locator('#writeGuideText').is_visible() and not page.locator('#writeStrokeGuide').is_visible()
 page.locator('#writeShowStrokeOrder').check();page.locator('#writeShowGuide').uncheck();assert not page.locator('#writeStrokeGuide').is_visible() and not page.locator('#writeGuideText').is_visible()
 page.locator('#writeShowGuide').check();assert page.locator('#writeStrokeGuide').is_visible()
 print('PASS guide and stroke-number toggles preserve original plain-text fallback')
 page.locator('#writeStrokeDetails summary').click()
 with TemporaryDirectory() as directory:
  with page.expect_download() as download:page.locator('#writeSave').click()
  path=Path(directory)/'guide.png';download.value.save_as(path)
  im=Image.open(path).convert('RGB');assert sum(1 for r,g,b in im.get_flattened_data() if b>r+40 and g>r+10)>20
 print('PASS exported PNG contains the numbered guide without adding handwriting ink')
 # Resize without clearing existing child ink; guides fit narrow/large screens.
 for width,height in [(320,640),(820,1180),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height});page.clock.run_for(100)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert page.locator('#writeStrokeGuide svg').bounding_box()['width']<=page.locator('#writingPad').bounding_box()['width']
 print('PASS 320px phone, tablet and desktop guide layout')
 page.set_viewport_size({'width':820,'height':1180});page.clock.run_for(100);page.locator('#writingActivity').screenshot(path='/tmp/pokestudy-stroke-guide.png')
 # Stopping a playback by navigating prevents stale highlights on return.
 page.locator('#writePlayStrokes').click();page.clock.run_for(100);page.locator('[data-module=homeModule]').click();page.clock.run_for(1000)
 page.locator('[data-module=writeModule]').click();assert page.locator('#writePlayStrokes').inner_text()=='획순 재생'
 # Switch problem after real child handwriting; numeral retains a normal text guide.
 page.locator('#writeInk').scroll_into_view_if_needed();box=page.locator('#writeInk').bounding_box();page.mouse.move(box['x']+20,box['y']+30);page.mouse.down();page.mouse.move(box['x']+110,box['y']+70,steps=5);page.mouse.up()
 page.locator('#writeNext').click();page.wait_for_function("document.querySelector('#writePokemonName').textContent==='폴리곤2'")
 page.wait_for_function("document.querySelector('#writeStrokeGuide svg')?.getAttribute('aria-label')==='폴리곤2 획순 가이드'")
 assert '숫자' in page.locator('#writeStrokeStatus').inner_text();assert page.locator('#writeStrokeGuide text').filter(has_text='2').count()>0
 page.emulate_media(reduced_motion='reduce');page.locator('#writePlayStrokes').click();assert '1/' in page.locator('#writeStrokeStatus').inner_text();page.locator('#writePlayStrokes').click();assert '2/' in page.locator('#writeStrokeStatus').inner_text()
 print('PASS problem change, unsupported-digit fallback, navigation cancel and reduced-motion stepping')
 assert not errors,errors
 assert not any('cdn.jsdelivr' in r or 'unpkg.com' in r for r in requests)
 browser.close();server.shutdown()
