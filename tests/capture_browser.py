"""Capture integration tests: real IndexedDB/Chromium, deterministic API/image fixtures.
Starts its own server. Run: python tests/capture_browser.py
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import re
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
sprite=(root/'tests/fixtures/bulbasaur.png').read_bytes()

def fixture(route):
 url=route.request.url
 if 'generation/' in url:
  data={'pokemon_species':[{'url':f'https://pokeapi.co/api/v2/pokemon-species/{i}/'} for i in range(1,4)]}
 elif 'pokemon-species/' in url:
  i=int(re.search(r'pokemon-species/(\d+)',url)[1]);data={'id':i,'names':[{'language':{'name':'ko'},'name':f'테스트{i}'}]}
 else:
  data={'sprites':{'other':{'showdown':{'front_default':'https://raw.githubusercontent.com/fixture/animated.gif'}},'front_default':'https://raw.githubusercontent.com/fixture/still.png'}}
 route.fulfill(json=data)

def configure(context):
 context.route('https://pokeapi.co/**',fixture)
 context.route('https://raw.githubusercontent.com/**',lambda r:r.fulfill(body=sprite,content_type='image/png',headers={'Access-Control-Allow-Origin':'*'}))
 context.add_init_script('Math.random=()=>0.1;')

def snap(page):
 return page.evaluate("async()=>await (await import('./src/modules/capture/store.js')).snapshot()")

def swipe_mouse(page,dx=0,up=.26):
 box=page.locator('#captureStage').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.86
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+box['width']*dx,y-box['height']*up,steps=8);page.mouse.up()

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,reduced_motion='reduce')
 configure(context);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base);page.wait_for_function("!document.querySelector('#startWriting').disabled")
 page.locator('[data-module=captureModule]').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='empty'")
 assert '이름을 하나 쓰고' in page.locator('#captureMessage').inner_text()
 page.locator('#captureWrite').click();page.locator('#writeQuestionCount').fill('2');page.locator('#startWriting').click();page.wait_for_selector('#writingActivity:not(.hidden)')
 # Incomplete work / clear / export are not rewards. Ink is restored on reload.
 page.locator('#writeInk').scroll_into_view_if_needed()
 box=page.locator('#writeInk').bounding_box();page.mouse.move(box['x']+20,box['y']+30);page.mouse.down();page.mouse.move(box['x']+120,box['y']+70,steps=6);page.mouse.up()
 page.wait_for_function("async()=>!!(await (await import('./src/modules/capture/store.js')).snapshot()).writing?.ink")
 assert page.locator('#writeInk').evaluate("c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)"),'ink was not drawn'
 before=snap(page);assert sum(before['balances'].values())==0
 page.reload();page.wait_for_function("!document.querySelector('#startWriting').disabled")
 page.locator('[data-module=writeModule]').click();page.wait_for_selector('#writingActivity:not(.hidden)')
 page.wait_for_function("Array.from(document.querySelector('#writeInk').getContext('2d').getImageData(0,0,document.querySelector('#writeInk').width,document.querySelector('#writeInk').height).data).some((v,i)=>i%4===3&&v>0)")
 assert snap(page)['writing']['attempts']==before['writing']['attempts']
 page.locator('#writeClear').click();assert sum(snap(page)['balances'].values())==0
 page.locator('#writeNext').click();page.wait_for_selector('#writeReward:not(.hidden)')
 assert '몬스터볼 1개' in page.locator('#writeRewardText').inner_text()
 after=snap(page);assert after['balances']['normal']==1 and after['writing']['index']==1
 attempt=before['writing']['attempts'][0]['id'];session=before['writing']['id']
 page.evaluate("async ([s,a])=>{const m=await import('./src/modules/capture/store.js');await Promise.all([m.completeWriting(s,a),m.completeWriting(s,a)]);}",[session,attempt])
 assert snap(page)['balances']['normal']==1
 print('PASS writing progress/ink reload, incomplete +0, atomic reward and duplicate completion +0')
 page.locator('#writeGoCapture').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='ready'")
 # Tap, down, sideways, cancellation and multi-pointer cannot consume.
 swipe_mouse(page,up=0);swipe_mouse(page,up=-.1);swipe_mouse(page,dx=.2,up=.08)
 box=page.locator('#captureStage').bounding_box();page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.86);page.mouse.down();page.locator('#captureStage').dispatch_event('pointercancel',{'pointerId':1});page.mouse.up()
 assert snap(page)['balances']['normal']==1
 # Second tab cannot own the encounter or refund this tab's pending throw.
 tab=context.new_page();tab.goto(base);tab.locator('[data-module=captureModule]').click();tab.wait_for_function("document.querySelector('#captureStage').dataset.state==='blocked'")
 assert '다른 탭' in tab.locator('#captureMessage').inner_text();page.bring_to_front()
 swipe_mouse(page);page.wait_for_function("document.querySelector('#captureStage').dataset.state==='result'")
 caught=snap(page);assert caught['balances']['normal']==0 and len(caught['caught'])==1
 assert '잡았어요' in page.locator('#captureMessage').inner_text()
 page.reload();page.locator('[data-module=captureModule]').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='result'")
 assert snap(page)['caught']==caught['caught']
 print('PASS invalid gestures +0, cross-tab ownership, centered swipe consumes once, capture and reload result exactly once')
 tab.close();page.locator('#captureWrite').click();page.locator('#writeNext').click();page.wait_for_function("document.querySelector('#writeProgress').textContent.includes('완료')")
 page.locator('#writeGoCapture').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='result'")
 page.locator('#captureContinue').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='ready'")
 swipe_mouse(page,dx=.23,up=.26);page.wait_for_function("document.querySelector('#captureStage').dataset.state==='result'")
 assert '빗나갔어요' in page.locator('#captureMessage').inner_text();assert snap(page)['balances']['normal']==0
 print('PASS new completion +1, next encounter and diagonal miss consumes last ball without erasing learning')
 # Real IDB transactions: isolation, contention, idempotent recovery, response loss, write failure.
 page.locator('#captureWrite').click()
 result=page.evaluate('''async()=>{
  const m=await import('./src/modules/capture/store.js');const p={id:25,name:'피카츄'};const learner='storage-tests';
  const w=await m.startWriting([p,p],learner);
  await m.transact(s=>s.writing.attempts[0].random=.99,learner);
  const reward=await m.completeWriting(w.id,w.attempts[0].id,learner);
  if(reward.ball!=='master')throw Error('master reward');
  const same=await m.completeWriting(w.id,w.attempts[0].id,learner);
  if(same.ball!=='master')throw Error('reroll');
  const e=await m.ensureEncounter(p,learner);
  const throws=await Promise.allSettled(['t1','t2'].map(id=>m.beginThrow({id,ball:'master',random:.9999,encounterId:e.id},learner)));
  if(throws.filter(t=>t.status==='fulfilled').length!==1)throw Error('concurrent spend');
  const id=throws[0].status==='fulfilled'?'t1':'t2';
  await m.recoverThrows(learner);await m.recoverThrows(learner);
  let s=await m.snapshot(learner);if(s.balances.master!==1)throw Error('double refund');
  await m.settleThrow(id,'basic',learner);s=await m.snapshot(learner);if(Object.keys(s.caught).length)throw Error('refunded throw settled');
  await m.beginThrow({id:'caught',ball:'master',random:.9999,encounterId:e.id},learner);
  // Simulate losing the response: retry the same successful transaction.
  await m.settleThrow('caught','basic',learner);await m.settleThrow('caught','basic',learner);await m.recoverThrows(learner);
  s=await m.snapshot(learner);if(s.caught[25].count!==1||s.balances.master!==0)throw Error('duplicate catch/refund');
  const other=await m.snapshot('other-learner');if(Object.keys(other.attempts).length||Object.values(other.balances).some(Boolean))throw Error('learner isolation');
  const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new Error('injected disk failure')};
  let failed=false;try{await m.completeWriting(w.id,w.attempts[1].id,learner)}catch{failed=true}finally{IDBObjectStore.prototype.put=put}
  if(!failed)throw Error('failure was swallowed');s=await m.snapshot(learner);if(s.writing.index!==1)throw Error('partial commit');
  await m.completeWriting(w.id,w.attempts[1].id,learner);s=await m.snapshot(learner);if(s.writing.index!==2)throw Error('retry failed');
  return 'ok';
 }''')
 assert result=='ok';print('PASS IndexedDB atomicity, reward retry, learner isolation, concurrent last-ball spend, refund/settlement exclusion, save failure rollback')
 # Pending throw abandoned by page termination refunds on acquiring the scene lock.
 page.evaluate('''async()=>{const m=await import('./src/modules/capture/store.js');await m.transact(s=>{s.balances.normal=1;s.encounter.result=null;});const s=await m.snapshot();await m.beginThrow({id:'interrupted',ball:'normal',random:.1,encounterId:s.encounter.id});}''')
 page.reload();page.locator('[data-module=captureModule]').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='ready'")
 assert snap(page)['balances']['normal']==1 and snap(page)['throws']['interrupted']['status']=='refunded'
 print('PASS interrupted throw refunded once after reload')
 # Layouts, touch, viewport rotation cancellation and reduced motion.
 for width,height in [(320,640),(844,390),(820,1180),(1440,900)]:
  page.set_viewport_size({'width':width,'height':height});page.locator('#captureStage').scroll_into_view_if_needed()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  box=page.locator('#captureStage').bounding_box();assert box['width']>200 and box['height']>=170
  assert page.locator('#captureWrite').bounding_box()['height']>=48
  if width==844:
   for selector in ['#captureBall','#captureBack','#captureWrite']:
    rect=page.locator(selector).bounding_box();assert rect['y']>=0 and rect['y']+rect['height']<=height
 print('PASS 320px phone, landscape, tablet, desktop layouts and 48px actions')
 # Genuine touch input: two fingers cancel; rotating an aimed throw cancels.
 page.set_viewport_size({'width':390,'height':844});page.locator('#captureStage').scroll_into_view_if_needed()
 cdp=context.new_cdp_session(page);box=page.locator('#captureStage').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.86
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1},{'x':x+35,'y':y,'id':2}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert snap(page)['balances']['normal']==1
 page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y-15);assert not page.locator('#captureAimLine').evaluate("el=>el.hasAttribute('hidden')");page.set_viewport_size({'width':844,'height':390});page.mouse.move(x,y-100);page.mouse.up();assert page.locator('#captureAimLine').evaluate("el=>el.hasAttribute('hidden')")
 assert snap(page)['balances']['normal']==1
 print('PASS real multi-touch and viewport rotation cancel without spending')
 # Failed debit is visible and retryable without changing the balance.
 page.set_viewport_size({'width':390,'height':844});page.locator('#captureStage').scroll_into_view_if_needed()
 page.evaluate('()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw Error("disk full")}}')
 swipe_mouse(page);page.wait_for_function("document.querySelector('#captureStage').dataset.state==='save-error'")
 page.evaluate('()=>{IDBObjectStore.prototype.put=window.originalPut}')
 assert snap(page)['balances']['normal']==1
 page.locator('#captureSaveRetry').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='ready'")
 # Successful debit, failed settlement: retry the same throw ID and stored RNG.
 swipe_mouse(page);page.wait_for_function("document.querySelector('#captureStage').dataset.state==='flight'")
 page.evaluate('()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){IDBObjectStore.prototype.put=window.originalPut;throw Error("one failed settlement")}}')
 page.wait_for_function("document.querySelector('#captureStage').dataset.state==='save-error'")
 pending=snap(page);pending_ids=[k for k,t in pending['throws'].items() if t['status']=='pending'];assert len(pending_ids)==1
 page.locator('#captureSaveRetry').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='result'")
 settled=snap(page);assert settled['throws'][pending_ids[0]]['status']=='completed' and settled['balances']['normal']==0
 print('PASS debit and settlement storage errors show retry UI; retry preserves throw ID, RNG and single debit')
 # A reward from another tab refreshes the wallet; genuine touch swipe and pause/resume.
 reward_tab=context.new_page();reward_tab.goto(base)
 reward_tab.evaluate("async()=>{const m=await import('./src/modules/capture/store.js');const w=await m.startWriting([{id:25,name:'피카츄'}]);await m.completeWriting(w.id,w.attempts[0].id);}")
 page.wait_for_function("document.querySelector('[data-ball=normal] .ball-count').textContent==='1'")
 reward_tab.close();page.bring_to_front();page.locator('#captureContinue').click();page.wait_for_function("document.querySelector('#captureStage').dataset.state==='ready'")
 page.locator('#captureStage').scroll_into_view_if_needed();box=page.locator('#captureStage').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.86
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1}]})
 for step in range(1,7):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-box['height']*.26*step/6,'id':1}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.wait_for_function("document.querySelector('#captureStage').dataset.state==='flight'")
 page.evaluate("()=>{window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});document.dispatchEvent(new Event('visibilitychange'));}")
 page.wait_for_timeout(900)
 assert any(t['status']=='pending' for t in snap(page)['throws'].values())
 page.evaluate("()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));}")
 page.wait_for_function("document.querySelector('#captureStage').dataset.state==='result'")
 assert '피카츄를 잡았어요' in page.locator('#captureMessage').inner_text()
 print('PASS cross-tab reward refresh, real upward touch capture and hidden-page pause/resume')
 assert not errors,errors
 page.screenshot(path='/tmp/pokestudy-capture.png',full_page=True)
 context.close();browser.close();server.shutdown()
