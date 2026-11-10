import {BALLS,TUNING,defaultBall,totalBalls,swipe,ballPosition,targetPosition,contact,ringRatio,gradeAt,GRADE_NAMES} from './rules.js';
import {snapshot,ensureEncounter,beginThrow,settleThrow,recoverThrows,uid,onReward} from './store.js?v=20261110-reward-quantity';
import {loadSprite,FALLBACK} from './sprites.js';
const $=id=>document.getElementById(id),root=$('captureModule'),stage=$('captureStage');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let state='loading',data,encounter,selected='normal',active=false,token=0,time=0,last=null,aim=null;
let shot=null,flightStart=0,previousFlight=0,currentThrow=null,savedGrade=undefined,animationEnd=0;
let spriteBounds=null;
let unlock=null,owns=false,operation=Promise.resolve(),closing=Promise.resolve();
function message(text){$('captureMessage').textContent=text;}
function controls(){
  const busy=['loading','saving','flight','judging','animation'].includes(state);
  $('captureBalls').querySelectorAll('button').forEach(b=>{const k=b.dataset.ball;b.disabled=!owns||busy||state==='aiming'||!data?.balances[k];b.setAttribute('aria-pressed',String(k===selected));b.querySelector('.ball-count').textContent=data?.balances[k]??0;});
  $('captureSkip').hidden=state!=='animation';$('captureSaveRetry').hidden=state!=='save-error';
  $('captureLockRetry').hidden=owns||state!=='blocked';
  stage.dataset.state=state;
  $('captureBall').hidden=!['ready','aiming','flight','animation'].includes(state)||(state==='animation'&&encounter?.result?.kind==='miss');
  $('captureBall').dataset.ball=selected;

  $('captureTarget').hidden=!encounter||(state==='animation'&&encounter?.result?.kind!=='miss')||(state==='result'&&encounter.result?.kind==='caught');
  $('captureRing').hidden=!['ready','aiming','flight'].includes(state);
  const collection=$('captureCollectionList');collection.replaceChildren();
  const caught=Object.values(data?.caught||{}).sort((a,b)=>b.lastAt-a.lastAt);
  $('captureCollectionCount').textContent=`잡은 포켓몬 ${caught.length}종`;
  for(const c of caught){const item=document.createElement('li');item.textContent=`${c.pokemon.name} · ${c.count}마리 · 처음 ${new Date(c.firstAt).toLocaleDateString('ko-KR')} · 최근 ${new Date(c.lastAt).toLocaleDateString('ko-KR')}`;collection.append(item);}
  if(!caught.length){const item=document.createElement('li');item.textContent='아직 잡은 포켓몬이 없어요.';collection.append(item);}
}
onReward(async()=>{
  if(!active||!owns)return;
  try{const fresh=await snapshot();if(!active)return;data=fresh;if(state==='empty'){await initialize(token);}else if(['ready','result'].includes(state))controls();}catch{message('저장하지 못했어요. 다시 시도해요');}
});
function ready(notice=''){
  selected=defaultBall(data.balances,selected);state=totalBalls(data.balances)?'ready':'empty';
  message(state==='empty'?`${notice?notice+' ':''}이름을 하나 쓰고 몬스터볼을 받아요`:notice||'공을 위로 쓱 올려요. 쓰기 완료 기록은 언제나 남아요.');controls();
}
function showResult(){
  if(state==='loading')return;
  selected=defaultBall(data.balances,selected);const r=encounter.result,name=encounter.pokemon.name;
  const code=name.charCodeAt(name.length-1),particle=code>=0xac00&&code<=0xd7a3&&(code-0xac00)%28?'을':'를';
  const again=totalBalls(data.balances)>0;
  const notice=r.kind==='caught'?`${name}${particle} 잡았어요! ${GRADE_NAMES[r.grade]}!`:r.kind==='miss'?`공이 빗나갔어요!${again?' 다음 공을 위로 쓱 올려요.':''}`:`${GRADE_NAMES[r.grade]}! 아깝다! 볼에서 나왔어요.${again?' 다음 공으로 다시 도전해요.':''}`;
  $('captureBall').classList.remove('capture-shake');
  if(r.kind==='caught')nextEncounter(notice);else ready(notice);
}
function nextEncounter(notice){
  state='loading';message(notice);controls();const version=token;
  operation=(async()=>{
    try{
      const next=await ensureEncounter(candidate()),fresh=await snapshot();
      if(!active||version!==token)return;
      encounter=next;data=fresh;time=0;last=null;
      // Image loading can be canceled by leaving; do not hold the scene lock for it.
      loadEncounter(version,notice).catch(()=>{if(active&&version===token){state='save-error';message('저장하지 못했어요. 다시 시도해요');controls();}});
    }catch{if(active&&version===token){state='save-error';message('저장하지 못했어요. 다시 시도해요');controls();}}
  })();
}
async function loadEncounter(version,notice=''){
  if(!active||version!==token)return;
  state='loading';message(notice||'포켓몬을 만나러 가요…');controls();
  const p=encounter.pokemon;spriteBounds=null;
  $('captureName').textContent=p.name;$('captureTarget').src=FALLBACK;
  const result=await loadSprite(p,reduced.matches);
  if(!active||version!==token)return;
  $('captureTarget').src=result.url;$('captureTarget').alt=p.name;spriteBounds=result.bounds||null;
  $('captureImageNote').textContent=result.fallback?'그림을 불러오지 못해 기본 그림을 사용해요. 포획은 계속할 수 있어요.':'';
  if(encounter.result){state='result';showResult();}else ready(notice);
}
function candidate(){
  const learned=Object.values(data.attempts).sort((a,b)=>b.completedAt-a.completedAt);
  const preferred=learned[0]?.pokemon;
  if(!data.encounter)return preferred||data.writing?.questions[0];
  const pool=data.writing?.questions?.length?data.writing.questions:learned.map(a=>a.pokemon);
  const others=pool.filter(p=>p.id!==data.encounter?.pokemon.id),choices=others.length?others:pool;
  return choices.length?choices[Math.floor(Math.random()*choices.length)]:preferred;
}
async function initialize(version){
  data=await recoverThrows();if(!active||version!==token)return;
  selected=defaultBall(data.balances,selected);
  const p=candidate();
  if(!data.encounter&&!p){encounter=null;state='empty';message('이름을 하나 쓰고 몬스터볼을 받아요');controls();return;}
  const next=data.encounter||await ensureEncounter(p);if(!active||version!==token)return;encounter=next;time=0;last=null;
  await loadEncounter(version);
}
async function enter(){
  await closing;if(active)return;active=true;const version=++token;state='loading';controls();root.scrollIntoView({block:'start'});
  if(!navigator.locks){state='blocked';message('이 브라우저에서는 안전한 포획 저장을 지원하지 않아요. 최신 브라우저로 열어 주세요.');controls();return;}
  navigator.locks.request('pokestudy-capture-device-default',{ifAvailable:true},async lock=>{
    if(!active||version!==token)return;
    if(!lock){state='blocked';message('다른 탭에서 포켓몬을 잡고 있어요. 그 화면을 닫고 다시 시도해요.');controls();return;}
    owns=true;
    const held=new Promise(resolve=>{unlock=resolve;});
    try{await Promise.race([initialize(version),held]);await held;}catch(e){if(active&&version===token){state='save-error';message('저장하지 못했어요. 다시 시도해요');controls();}await held;}
    finally{owns=false;unlock=null;}
  }).catch(()=>{state='blocked';message('포획 화면을 열지 못했어요. 다시 시도해요.');controls();});
}
function cancelAim(){
  if(aim){const id=aim.id;aim=null;if(stage.hasPointerCapture?.(id))stage.releasePointerCapture(id);}
  $('captureAimLine').toggleAttribute('hidden',true);if(state==='aiming'){state='ready';controls();}
}
function leave(){
  if(!active)return closing;active=false;++token;cancelAim();last=null;
  closing=(async()=>{try{await operation;if(owns)await recoverThrows();}catch{}finally{unlock?.();}})();return closing;
}
function point(e){const r=stage.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height,time:e.timeStamp};}
function drawPosition(element,p){element.style.left=`${p.x*100}%`;element.style.top=`${p.y*100}%`;}
// Pastel color stops follow the same 60% / 30% boundaries as aim grades.
function ringColor(ratio){
  const green=[166,220,180],orange=[249,193,139],red=[239,154,162];
  const blend=(from,to,t)=>from.map((v,i)=>Math.round(v+(to[i]-v)*t));
  const color=ratio>.65?green:ratio>.6?blend(green,orange,(.65-ratio)/.05):ratio>.35?orange:ratio>.3?blend(orange,red,(.35-ratio)/.05):red;
  return `rgb(${color.join(', ')})`;
}
function draw(){
  if(!encounter)return;
  const p=targetPosition(time,encounter.seed,reduced.matches),ratio=ringRatio(time,reduced.matches);
  const target=$('captureTarget');
  if(spriteBounds){
    const b=spriteBounds,w=stage.clientWidth,h=stage.clientHeight;
    const imageHeight=Math.min(w*.24/(b.w*b.aspect),h*.23/b.h),imageWidth=imageHeight*b.aspect;
    target.style.width=`${imageWidth}px`;target.style.height=`${imageHeight}px`;
    target.style.left=`${p.x*w+(.5-b.x-b.w/2)*imageWidth}px`;
    target.style.top=`${p.y*h+(.5-b.y-b.h/2)*imageHeight}px`;
  }else drawPosition(target,p);
  drawPosition($('captureRing'),p);
  $('captureRing').style.setProperty('--ring-color',ringColor(ratio));
  const ringSize=stage.clientHeight*TUNING.ringRadius*2*ratio;
  $('captureRing').style.width=`${ringSize}px`;$('captureRing').style.height=`${ringSize}px`;
  const pos=state==='flight'?ballPosition(shot,time-flightStart):state==='animation'?{x:.5,y:.38}:{x:.5,y:.86};drawPosition($('captureBall'),pos);
}
function judge(grade){
  state='judging';savedGrade=grade;controls();
  const version=token;
  operation=(async()=>{
    try{
      const record=await settleThrow(currentThrow.id,grade);data=await snapshot();encounter=data.encounter;
      if(!active||version!==token)return;
      if(record.status!=='completed'){ready();return;}
      state='animation';animationEnd=time+(reduced.matches?.15:.85);if(record.result.kind!=='miss')$('captureBall').classList.add('capture-shake');controls();
      message(record.result.kind==='miss'?'공이 빗나갔어요…':'볼이 흔들려요…');
    }catch{if(active&&version===token){state='save-error';message('저장하지 못했어요. 다시 시도해요');controls();}}
  })();
}
function tick(now){
  requestAnimationFrame(tick);
  if(!active||document.hidden||['loading','blocked','save-error'].includes(state)){last=null;return;}
  const dt=last===null?0:(now-last)/1000;last=now;time+=dt;
  if(state==='flight'){
    const end=Math.min(time-flightStart,TUNING.duration);
    for(let a=previousFlight;a<end;){
      const b=Math.min(a+1/120,end),pa=ballPosition(shot,a),pb=ballPosition(shot,b);
      const ta=targetPosition(flightStart+a,encounter.seed,reduced.matches),tb=targetPosition(flightStart+b,encounter.seed,reduced.matches);
      const u=contact(pa,pb,ta,tb,TUNING.radiusX+26/stage.clientWidth,TUNING.radiusY+26/stage.clientHeight);
      if(u!==null){
        const t=a+(b-a)*u,hit=ballPosition(shot,t),target=targetPosition(flightStart+t,encounter.seed,reduced.matches);
        const ratio=ringRatio(flightStart+t,reduced.matches);
        const distance=Math.max(0,Math.hypot((hit.x-target.x)*stage.clientWidth,(hit.y-target.y)*stage.clientHeight)-26)/(stage.clientHeight*TUNING.ringRadius);
        judge(gradeAt(distance,ratio));break;
      }
      a=b;
    }
    previousFlight=end;
    const p=ballPosition(shot,end);
    if(state==='flight'&&(end>=TUNING.duration||p.x<-.1||p.x>1.1||p.y<-.2||p.y>1.1))judge(null);
  }
  if(state==='animation'&&time>=animationEnd)showResult();draw();
}
for(const [key,b] of Object.entries(BALLS)){
  const button=document.createElement('button');button.dataset.ball=key;button.type='button';button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='ball-icon';icon.dataset.ball=key;icon.setAttribute('aria-hidden','true');
  const count=document.createElement('span');count.className='ball-count';count.textContent='0';
  button.append(icon,document.createTextNode(b.name+' × '),count);
  button.onclick=()=>{if(['ready','result','empty'].includes(state)){selected=key;controls();}};$('captureBalls').append(button);
}
document.addEventListener('pointerdown',e=>{if(aim&&aim.id!==e.pointerId)cancelAim();},true);
stage.addEventListener('pointerdown',e=>{
  if(aim&&e.pointerId!==aim.id){cancelAim();return;}
  if(state!=='ready'||!owns||e.isPrimary===false||e.button!==0)return;
  const p=point(e),r=stage.getBoundingClientRect();
  if(Math.hypot((p.x-.5)*r.width,(p.y-.86)*r.height)>40)return;
  e.preventDefault();aim={id:e.pointerId,start:p,previous:p,last:p,ball:selected};try{stage.setPointerCapture(e.pointerId);}catch{aim=null;return;}state='aiming';controls();
});
stage.addEventListener('pointermove',e=>{
  if(aim?.id!==e.pointerId)return;aim.previous=aim.last;aim.last=point(e);
  const line=$('captureAimLine');line.toggleAttribute('hidden',false);line.setAttribute('x1',aim.start.x);line.setAttribute('y1',aim.start.y);line.setAttribute('x2',aim.last.x);line.setAttribute('y2',aim.last.y);
});
stage.addEventListener('pointerup',e=>{
  if(aim?.id!==e.pointerId)return;
  const gesture=aim,trajectory=swipe(gesture.start,point(e),gesture.previous);cancelAim();
  if(!trajectory){message('공에서 시작해 위로 길게 쓱 올려요. 볼은 그대로 있어요.');return;}
  const record={id:uid(),encounterId:encounter.id,pokemonId:encounter.pokemon.id,ball:gesture.ball,random:Math.random(),createdAt:Date.now()};
  currentThrow=record;savedGrade=undefined;shot=trajectory;state='saving';controls();const version=token;
  operation=(async()=>{
    try{currentThrow=await beginThrow(record);data=await snapshot();if(!active||version!==token)return;selected=gesture.ball;state='flight';flightStart=time;previousFlight=0;controls();message('공이 날아가요!');}
    catch{
      try{data=await snapshot();const stored=data.throws[record.id];if(stored?.status==='pending'){currentThrow=stored;if(active&&version===token){state='flight';flightStart=time;previousFlight=0;controls();}return;}}catch{}
      if(active&&version===token){state='save-error';message('저장하지 못했어요. 다시 시도해요');controls();}
    }
  })();
});
for(const event of ['pointercancel','lostpointercapture'])stage.addEventListener(event,cancelAim);
$('captureSkip').onclick=showResult;
$('captureSaveRetry').onclick=async()=>{
  if(currentThrow&&savedGrade!==undefined){try{data=await snapshot();if(data.throws[currentThrow.id]?.status==='pending'){judge(savedGrade);return;}}catch{}}
  try{await initialize(token);}catch{message('저장하지 못했어요. 다시 시도해요');}
};
$('captureLockRetry').onclick=async()=>{await leave();enter();};
$('captureBack').onclick=()=>document.querySelector('[data-module="writeModule"]').click();
$('captureWrite').onclick=()=>document.querySelector('[data-module="writeModule"]').click();
new MutationObserver(()=>{if(root.classList.contains('hidden'))leave();else enter();}).observe(root,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{last=null;cancelAim();if(!document.hidden&&active&&owns&&!['flight','saving','judging','animation','save-error'].includes(state)){snapshot().then(s=>{data=s;if(state==='empty'&&totalBalls(s.balances)){if(encounter)ready();else initialize(token).catch(()=>message('저장하지 못했어요. 다시 시도해요'));}else controls();}).catch(()=>message('저장하지 못했어요. 다시 시도해요'));}});
window.addEventListener('resize',cancelAim);window.addEventListener('pagehide',leave);
window.addEventListener('pageshow',()=>{if(!root.classList.contains('hidden'))enter();});
reduced.addEventListener('change',()=>{cancelAim();if(active&&encounter&&['ready','result','empty'].includes(state))loadEncounter(++token);});
requestAnimationFrame(tick);
