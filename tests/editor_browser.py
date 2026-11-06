"""Run with Python Playwright and /usr/bin/chromium. Starts its own local server.
Exercises real supplied images; no API or sprite fixtures are used.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from tempfile import TemporaryDirectory
import json,io,base64,os
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root.parent)))
Thread(target=server.serve_forever,daemon=True).start()
theme=os.environ.get('EDITOR_THEME','forest')
store=f'pokestudy-{theme}-editor-v1'
first_asset='tree-hollow' if theme=='forest' else 'palm-tall'
rock_asset='rock-round' if theme=='forest' else 'rock-small'
manifest_path=root/f'asset-packages/{theme}-01/manifest.json'
with sync_playwright() as pw,TemporaryDirectory() as tmp:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,height,dpr,touch in [(1600,1000,1,False),(1180,820,2,True),(390,844,3,True)]:
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,has_touch=touch,accept_downloads=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/{root.name}/editor/?theme={theme}')
  page.wait_for_function("document.querySelector('#saveJson').disabled===false")
  assert page.locator('.asset-button').count()==(35 if theme=='forest' else 17)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  def saved():
   page.wait_for_function("document.querySelector('#storageStatus').textContent.includes('자동 저장됨')")
   return page.evaluate(f'JSON.parse(localStorage.getItem("{store}"))')
  def add(asset):
   button=page.locator(f'[data-asset-id="{asset}"]')
   if touch:button.tap()
   else:button.click()
   page.wait_for_function("document.querySelector('#loading').hidden===true")
  def layer(index):
   page.locator('#layerList button').nth(index).click()
  add(first_asset);assert page.locator('#layerList button').count()==1
  before=saved()['objects'][0];asset=next(a for a in json.loads(manifest_path.read_text())['assets'] if a['id']==first_asset)
  # Select an actual opaque part of the tree and drag by mouse or real touch events.
  image=Image.open(manifest_path.parent/asset['file']);alpha=image.getchannel('A');bbox=asset['visibleBounds'];point=None
  for sy in range(bbox[1]+(bbox[3]-bbox[1])//3,bbox[3],10):
   for sx in range(bbox[0]+(bbox[2]-bbox[0])//3,bbox[2],10):
    if alpha.getpixel((sx,sy))>250:point=(sx,sy);break
   if point:break
  canvas=page.locator('#stage');canvas.scroll_into_view_if_needed();b=canvas.bounding_box();ow=before['width'];oh=ow*1672/941*(bbox[3]-bbox[1])/(bbox[2]-bbox[0]);x=b['x']+(before['x']+(point[0]-bbox[0])/(bbox[2]-bbox[0])*ow)*b['width'];y=b['y']+(before['y']+(point[1]-bbox[1])/(bbox[3]-bbox[1])*oh)*b['height'];dx=b['width']*.06;dy=b['height']*.06
  if touch:
   cdp=context.new_cdp_session(page)
   cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx,'y':y+dy}]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  else:
   page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=8);page.mouse.up()
  after=saved()['objects'][0];assert abs(after['x']-before['x']-.06)<.004 and abs(after['y']-before['y']-.06)<.004,(before,after)
  page.locator('#undo').click();assert abs(saved()['objects'][0]['x']-before['x'])<1e-9
  page.locator('#redo').click();assert abs(saved()['objects'][0]['x']-after['x'])<1e-9
  # A range change is one undo action, and the bottom-right handle also resizes.
  page.locator('#size').fill('30');page.locator('#size').dispatch_event('change');assert abs(saved()['objects'][0]['width']-.3)<.001
  current=saved()['objects'][0];canvas.scroll_into_view_if_needed();b=canvas.bounding_box();rheight=current['width']*1672/941*(bbox[3]-bbox[1])/(bbox[2]-bbox[0]);hx=b['x']+(current['x']+current['width'])*b['width']-2;hy=b['y']+(current['y']+rheight)*b['height']-2;page.mouse.move(hx,hy);page.mouse.down();page.mouse.move(hx+15,hy+10,steps=5);page.mouse.up();assert saved()['objects'][0]['width']>.3
  page.locator('#flip').click();assert saved()['objects'][0]['flipX'] is True
  page.locator('#duplicate').click();assert len(saved()['objects'])==2
  page.locator('#backward').click();state=saved();assert state['objects'][0]['id']!=before['id']
  page.locator('#toggleHidden').click();assert saved()['objects'][0]['hidden'] is True
  if not touch:
   page.locator(f'[data-asset-id={rock_asset}]').drag_to(canvas,target_position={'x':100,'y':100})
   page.wait_for_function("document.querySelector('#loading').hidden===true")
  else:add(rock_asset)
  assert len(saved()['objects'])==3
  assert saved()['objects'][-1]['assetId']==rock_asset
  with page.expect_download() as download:page.locator('#saveJson').click()
  path=Path(tmp)/f'layout-{width}.json';download.value.save_as(path);exported=json.loads(path.read_text());assert len(exported['objects'])==3
  with page.expect_download() as download:page.locator('#savePng').click()
  png=Path(tmp)/f'layout-{width}.png';download.value.save_as(png)
  page.keyboard.press('Escape')
  rendered=base64.b64decode(page.locator('#stage').evaluate("c=>c.toDataURL('image/png').split(',')[1]"))
  with Image.open(png) as im,Image.open(io.BytesIO(rendered)) as expected:
   assert im.size==(1672,941)
   assert ImageChops.difference(im.convert('RGB'),expected.convert('RGB')).getbbox() is None, 'PNG contains selection decoration'
  page.locator('#clear').click();assert page.locator('#layerList button').count()==0
  page.locator('#loadJson').set_input_files(path);page.wait_for_function("document.querySelector('#layerList').children.length===3")
  assert saved()==exported
  page.locator('#loadJson').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"version":999}'})
  page.wait_for_function("document.querySelector('#status').textContent.includes('JSON')")
  assert saved()==exported
  page.reload();page.wait_for_function("document.querySelector('#saveJson').disabled===false")
  assert saved()==exported
  assert page.locator('#layerList button').count()==3
  layer(0);page.locator('#delete').click();assert len(saved()['objects'])==2
  page.locator('#undo').click();assert len(saved()['objects'])==3
  if width==1180:page.screenshot(path=f'/tmp/pokestudy-{theme}-editor-tablet.png',full_page=True)
  if theme=='sea' and width==1180:
   forest=json.loads((root/'public/assets/forest/scene-01/forest-layout.json').read_text())
   page.evaluate('(v)=>localStorage.setItem("pokestudy-forest-editor-v1",JSON.stringify(v))',forest)
   page.locator('#themePicker').select_option('forest');page.wait_for_url('**/editor/?theme=forest');page.wait_for_function("document.querySelector('#layerList').children.length===49")
   page.locator('#themePicker').select_option('sea');page.wait_for_url('**/editor/?theme=sea');page.wait_for_function("document.querySelector('#layerList').children.length===3")
   assert saved()==exported
   page.locator('#loadJson').set_input_files(root/'public/assets/forest/scene-01/forest-layout.json');page.wait_for_function("document.querySelector('#status').textContent.includes('테마')");assert saved()==exported
   print('PASS cross-theme storage isolation and forest-file rejection in sea editor',flush=True)
  assert not errors,errors
  print(f'PASS {theme} {width}x{height} DPR{dpr}: add, drag, handle/slider resize, undo/redo, flip, duplicate, layers, hide, JSON round trip, invalid import, PNG, reload, delete/undo',flush=True)
  context.close()
 browser.close()
server.shutdown()
