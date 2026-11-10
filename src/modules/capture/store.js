import {rewardBall,rewardQuantity,BALLS,outcome} from './rules.js?v=20261110-reward-quantity';
export const uid=()=>crypto.randomUUID();
const EMPTY=()=>({version:1,balances:{normal:0,super:0,hyper:0,master:0},attempts:{},throws:{},caught:{},encounter:null,writing:null});
let opening;
const updates=typeof BroadcastChannel==='undefined'?null:new BroadcastChannel('pokestudy-capture-updates');
export function onReward(callback){if(updates)updates.addEventListener('message',callback);}

function database(){
  return opening??=new Promise((resolve,reject)=>{
    const r=indexedDB.open('pokestudy-capture-v1',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('learners');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>{opening=null;reject(r.error);};
  });
}
// A learner's ledger, balances, progress and collection share ONE atomic record.
export async function transact(change,learner='device-default'){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('learners','readwrite'),store=tx.objectStore('learners');let value;
    const read=store.get(learner);
    read.onsuccess=()=>{try{const state=read.result||EMPTY();value=change(state);store.put(state,learner);}catch(e){value=e;tx.abort();}};
    tx.oncomplete=()=>resolve(value);
    tx.onabort=()=>reject(value instanceof Error?value:tx.error||new Error('저장 실패'));
    tx.onerror=()=>{};
  });
}
export const snapshot=(learner)=>transact(s=>structuredClone(s),learner);
export async function startWriting(questions,learner){
  const attempts=questions.map(()=>({id:uid(),random:Math.random(),quantityRandom:Math.random()}));
  return transact(s=>{s.writing={id:uid(),questions,index:0,attempts,ink:null};return structuredClone(s.writing);},learner);
}
export const saveInk=(sessionId,attemptId,ink,learner)=>transact(s=>{
  if(s.writing?.id===sessionId&&s.writing.attempts[s.writing.index]?.id===attemptId)s.writing.ink=ink;
},learner);
// Old in-progress sessions lack a quantity seed. Derive one from their stable ID
// so retries, aborted saves and different tabs cannot reroll their quantity.
function legacyQuantityRandom(id){let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619);return (hash>>>0)/4294967296;}
export const completeWriting=(sessionId,attemptId,learner)=>transact(s=>{
  if(s.attempts[attemptId])return structuredClone({...s.attempts[attemptId],quantity:s.attempts[attemptId].quantity??1});
  const w=s.writing,a=w?.attempts[w.index];
  if(w?.id!==sessionId||a?.id!==attemptId)throw new Error('다른 화면에서 진행이 바뀌었어요. 다시 열어 주세요.');
  const pokemon=w.questions[w.index],ball=rewardBall(a.random),quantity=rewardQuantity(a.quantityRandom??legacyQuantityRandom(a.id));
  const result={id:attemptId,pokemon,ball,quantity,completedAt:Date.now()};
  s.attempts[attemptId]=result;s.balances[ball]+=quantity;w.index++;w.ink=null;
  return structuredClone(result);
},learner).then(result=>{updates?.postMessage({type:'reward'});return result;});
export const ensureEncounter=(pokemon,learner)=>transact(s=>{
  if(!s.encounter || s.encounter.result?.kind==='caught'){
    s.encounter={id:uid(),pokemon,misses:0,first:Object.keys(s.caught).length===0&&!s.encounter,seed:Math.random()*1000,result:null};
  }
  return structuredClone(s.encounter);
},learner);
export const beginThrow=(record,learner)=>transact(s=>{
  if(s.throws[record.id])return structuredClone(s.throws[record.id]);
  if(!BALLS[record.ball]||s.balances[record.ball]<1)throw new Error('볼이 없어요. 이름을 쓰고 받아요.');
  if(s.encounter?.id!==record.encounterId||s.encounter.result?.kind==='caught')throw new Error('조우가 바뀌었어요.');
  if(Object.values(s.throws).some(t=>t.status==='pending'))throw new Error('진행 중인 공이 있어요.');
  s.balances[record.ball]--;s.encounter.result=null;
  s.throws[record.id]={...record,status:'pending'};
  return structuredClone(s.throws[record.id]);
},learner);
export const settleThrow=(id,grade,learner)=>transact(s=>{
  const t=s.throws[id];if(!t)throw new Error('투척 기록이 없어요.');
  if(t.status!=='pending')return structuredClone(t);
  const e=s.encounter;if(e?.id!==t.encounterId)throw new Error('조우가 바뀌었어요.');
  t.result=outcome(t,e,grade);t.status='completed';e.result={...t.result,throwId:id};
  if(t.result.kind==='escaped')e.misses++;
  if(t.result.kind==='caught'){
    const p=e.pokemon,now=Date.now(),old=s.caught[p.id];
    s.caught[p.id]={pokemon:p,firstAt:old?.firstAt??now,lastAt:now,count:(old?.count||0)+1};
  }
  return structuredClone(t);
},learner);
// Caller must hold the scene's cross-tab Web Lock. Completed throws cannot refund.
export const recoverThrows=(learner)=>transact(s=>{
  for(const t of Object.values(s.throws))if(t.status==='pending'){t.status='refunded';s.balances[t.ball]++;}
  return structuredClone(s);
},learner);
