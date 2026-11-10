"""Deterministic fixtures: validates interactions, NOT live PokéAPI or art quality.
Requires Playwright Python and /usr/bin/chromium. Server must run on port 8000.
TEST_SPRITE points to a real PNG used solely by intercepted test requests.
"""
import json,os,re,time
from pathlib import Path
from playwright.sync_api import sync_playwright
sprite=Path(os.environ.get('TEST_SPRITE',str(Path(__file__).parent/'fixtures/bulbasaur.png'))).read_bytes()
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,height,dpr in [(3840,2160,1),(1180,820,2),(768,1024,2),(390,844,3)]:
  context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,has_touch=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script('''window.pokemonDraws=[];const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(this.canvas.id==='hideScene'&&im.src?.includes('raw.githubusercontent.com'))window.pokemonDraws.push({src:im.src,args});return draw.call(this,im,...args)};''')
  def api(route):
   url=route.request.url
   if 'generation/' in url: data={'pokemon_species':[{'url':f'https://pokeapi.co/api/v2/pokemon-species/{i}/','name':f'test-{i}'} for i in range(1,61)]}
   elif 'pokemon-species/' in url:
    i=int(re.search(r'pokemon-species/(\d+)',url)[1]);data={'id':i,'name':f'test-{i}','names':[{'language':{'name':'ko'},'name':f'테스트{i}'}],'generation':{'name':'generation-i'}}
   else: data={}
   route.fulfill(json=data)
  page.route('https://pokeapi.co/**',api)
  page.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(body=sprite,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'}))
  page.goto(os.environ.get('BASE_URL','http://127.0.0.1:8000/'));page.wait_for_selector('#homeModule:not(.hidden)')
  # Explicit fixture population avoids 300 live requests and makes species assertions deterministic.
  page.evaluate('''localStorage.setItem('pokedexHiddenCandidatesV1',JSON.stringify(Array.from({length:60},(_,i)=>({id:i+1,name:'테스트'+(i+1),types:['grass'],image:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i+1}.png`,fallback:`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i+1}.png`}))));''')
  page.locator('nav [data-module="hideModule"]').click()
  page.locator(f'[data-theme={os.environ.get("TEST_THEME","forest")}]').click()
  for level,targets,total in [('easy',4,12),('normal',8,25),('hard',12,45)]:
   page.locator(f'[data-level={level}]').click();page.evaluate('window.pokemonDraws=[]');start=time.monotonic();page.locator('#hideStartBtn').click();page.wait_for_selector('#hideGame:not(.hidden)');
   assert page.locator('#hideTargets .hide-target').count()==targets
   draws=page.evaluate('window.pokemonDraws');assert len(draws)==total,(len(draws),total)
   ids=page.locator('#hideTargets [data-pokemon-id]').evaluate_all('(els)=>els.map(e=>+e.dataset.pokemonId)')
   # Touch exact rendered centers, including targets beneath foreground objects.
   canvas=page.locator('#hideScene');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
   logical=canvas.evaluate('(c)=>({width:c.width,height:c.height})')
   for id in ids:
    canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
    draw=next(d for d in draws if int(re.search(r'/(\d+)\.png',d['src'])[1])==id);x,y,w,h=draw['args']
    page.touchscreen.tap(box['x']+(x+w/2)/logical['width']*box['width'],box['y']+(y+h/2)/logical['height']*box['height'])
   if page.locator('#hideTargets .found').count()!=targets:
    page.screenshot(path='/tmp/pokestudy-failure.png',full_page=True)
    raise AssertionError((width,level,box,ids,page.locator('#hideTargets .found').count()))
   page.locator('#hideAnswerBtn').click();assert page.locator('#hideAnswerBtn').is_disabled()
   page.locator('#hideAgainBtn').click();page.wait_for_function("document.querySelector('#hideAgainBtn').disabled===false")
   assert page.locator('#hideTargets .found').count()==0
   assert page.locator('#hideAnswerBtn').is_enabled()
   page.locator('#hideBackBtn').click()
   print(f'PASS {width}x{height} DPR {dpr} {level}: {total}/{targets}, touch completion, reveal, restart ({time.monotonic()-start:.2f}s)')
  for module in ['quizModule','colorModule','writeModule']:
   page.locator(f'nav [data-module={module}]').click();assert page.locator('#'+module).is_visible()
  if width==1180:
   page.locator('nav [data-module=quizModule]').click();page.locator('#questionCount').fill('2');page.locator('#startBtn').click();page.wait_for_selector('#choices .choice');assert page.locator('#choices .choice').count()==4
   assert page.locator('#quitBtn').bounding_box()['x']>page.locator('#questionPill').bounding_box()['x']
   page.locator('#choices .choice').first.click();assert page.locator('#nextBtn').is_visible();page.locator('#quitBtn').click()
   page.locator('input[name=questionMode][value=reveal]').check();page.locator('#startBtn').click();page.wait_for_selector('#nextBtn:not(.hidden)',timeout=8000);assert page.locator('#choices').is_hidden();page.locator('#quitBtn').click()
   page.locator('nav [data-module=colorModule]').click();page.locator('#loadColorPool').click();page.wait_for_function("document.querySelector('#colorReference').naturalWidth>0")
   assert page.locator('#colorPalette button').count()>20
   def draw_and_save(canvas,button):
    el=page.locator(canvas);el.scroll_into_view_if_needed();b=el.bounding_box();page.mouse.move(b['x']+20,b['y']+20);page.mouse.down();page.mouse.move(b['x']+100,b['y']+80,steps=8);page.mouse.up()
    assert page.eval_on_selector(canvas,"c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)")
    with page.expect_download() as download:page.locator(button).click()
    assert download.value.suggested_filename.endswith('.png')
   draw_and_save('#colorInk','#colorSave')
   page.locator('nav [data-module=writeModule]').click();page.locator('#writeQuestionCount').fill('2');page.locator('#startWriting').click();page.wait_for_selector('#writingActivity:not(.hidden)');assert page.locator('#writeGuideText').inner_text().startswith('테스트')
   draw_and_save('#writeInk','#writeSave');page.locator('#writeNext').click();page.wait_for_function("document.querySelector('#writeProgress').textContent.includes('2 / 2')");assert '2 / 2' in page.locator('#writeProgress').inner_text()
   print('PASS learning regression fixtures: four choices, quit position, 3-second reveal, coloring palette/ink/save, handwriting guide/ink/save/next')
  assert not errors,errors
  if width==1180:
   page.locator('nav [data-module=hideModule]').click();page.locator('#hideStartBtn').click();page.wait_for_selector('#hideGame:not(.hidden)');page.screenshot(path='/tmp/pokestudy-forest-tablet.png',full_page=True)
  context.close()
 browser.close()
