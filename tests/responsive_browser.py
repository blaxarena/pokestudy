"""Responsive/touch and focus-mode checks with local API/sprite fixtures.
Runs its own server; requires Python Playwright, Pillow and Chromium.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
import re
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
sprite=(root/'tests/fixtures/bulbasaur.png').read_bytes()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for name,width,height in [('ipad-landscape',1194,834),('ipad-portrait',834,1194),('fold-landscape',882,768),('fold-portrait',768,882),('portable',1920,1080),('macbook',1512,982),('phone',390,844)]:
  context=browser.new_context(viewport={'width':width,'height':height},has_touch=True,device_scale_factor=2)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('''window.draws=[];const d=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(this.canvas.id==='hideScene'&&im.src?.includes('raw.githubusercontent.com'))window.draws.push({src:im.src,args});return d.call(this,im,...args)};localStorage.setItem('pokedexHiddenCandidatesV1',JSON.stringify(Array.from({length:60},(_,i)=>({id:i+1,name:'테스트'+(i+1),types:['water'],image:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i+1}.png`,fallback:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i+1}.png`}))));''')
  page.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(body=sprite,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'}))
  page.goto(base+'?play=sea');page.locator('[data-level=hard]').click();page.locator('#hideStartBtn').click();page.wait_for_selector('#hideGame:not(.hidden)')
  def check_bounds():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
   rect=page.locator('#hideScene').bounding_box();assert abs(rect['width']/rect['height']-16/9)<.005
   assert rect['x']>=0 and rect['x']+rect['width']<=page.viewport_size['width']+1
   return rect
  regular=check_bounds();assert page.locator('#hideTargets .hide-target').count()==12
  page.locator('#hideFocusBtn').click();page.wait_for_function('document.body.classList.contains("game-focus")')
  page.wait_for_timeout(150);rect=check_bounds();assert rect['y']>=0 and rect['y']+rect['height']<=height,name
  assert page.locator('#hideFocusBtn').get_attribute('aria-pressed')=='true'
  # In focus mode all controls fit; overflow is limited to the target list itself.
  assert page.locator('#hideGame').evaluate('e=>e.scrollHeight<=e.clientHeight+3'),(name,page.locator('#hideGame').evaluate('e=>[e.scrollHeight,e.clientHeight]'))
  id=int(page.locator('#hideTargets [data-pokemon-id]').first.get_attribute('data-pokemon-id'))
  draw=next(d for d in page.evaluate('window.draws') if int(re.search(r'/(\d+)\.png',d['src'])[1])==id)
  x,y,w,h=draw['args'];page.touchscreen.tap(rect['x']+(x+w/2)/1672*rect['width'],rect['y']+(y+h/2)/941*rect['height']);assert page.locator('#hideTargets .found').count()==1
  page.screenshot(path=f'/tmp/pokestudy-focus-{name}.png',full_page=True)
  # Changing device orientation while playing retains the found state and scene.
  if name=='fold-landscape':
   page.set_viewport_size({'width':height,'height':width});page.wait_for_timeout(150);check_bounds();assert page.locator('#hideTargets .found').count()==1
  page.keyboard.press('Escape');assert not page.evaluate('document.body.classList.contains("game-focus")')
  assert page.locator('#hideFocusBtn').get_attribute('aria-pressed')=='false'
  page.locator('#hideFocusBtn').click();page.locator('#hideAnswerBtn').click();assert page.locator('#hideAnswerBtn').is_disabled()
  page.locator('#hideAgainBtn').click();page.wait_for_function('!document.querySelector("#hideAgainBtn").disabled');assert page.locator('#hideTargets .found').count()==0
  assert page.evaluate('document.body.classList.contains("game-focus")')
  page.locator('#hideBackBtn').click();assert not page.evaluate('document.body.classList.contains("game-focus")')
  assert page.locator('#hideSetup').is_visible();assert not errors,errors
  print(f'PASS {name} {width}×{height}: 16:9, no overflow, focus fits, touch, orientation, Escape, answers/restart, exit',flush=True)
  context.close()
 browser.close()
server.shutdown()
