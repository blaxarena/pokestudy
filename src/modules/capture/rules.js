// All initial tuning values live here. Coordinates are fractions of the play area.
export const BALLS = {
  normal: {name:'몬스터볼', mark:'◓', color:'#e85155', weight:.70, bonus:0},
  super: {name:'슈퍼볼', mark:'S', color:'#287ad4', weight:.20, bonus:.10},
  hyper: {name:'하이퍼볼', mark:'H', color:'#b48708', weight:.09, bonus:.20},
  master: {name:'마스터볼', mark:'M', color:'#894dc6', weight:.01, bonus:0}
};
export const TUNING = Object.freeze({minSwipe:.06, gravity:1.2, duration:2, radiusX:.042, radiusY:.028, ringRadius:.15,
  ballRadius:.025, moveInterval:3, moveDuration:.55, firstPause:5, ringPeriod:2.4});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function rewardBall(random){
  let edge=0; for(const [key,b] of Object.entries(BALLS)){edge+=b.weight;if(random<edge)return key;} return 'master';
}
export function defaultBall(balances, previous){return balances[previous]>0?previous:Object.keys(BALLS).find(k=>balances[k]>0)||'normal';}
export const totalBalls=b=>Object.values(b).reduce((a,v)=>a+v,0);
export function swipe(start,end,previous=start){
  const dx=end.x-start.x,up=start.y-end.y,seconds=Math.max(.04,(end.time-start.time)/1000);
  if(up<TUNING.minSwipe || up<=Math.abs(dx))return null;
  const tail=Math.max(0,(previous.y-end.y)/Math.max(.016,(end.time-previous.time)/1000));
  return {x:.5,y:.86,vx:clamp(dx/up*1.35,-1.3,1.3),vy:clamp(.83+up*.9+Math.min(2,(up/seconds+tail)/2)*.12,.9,1.65)};
}
export function ballPosition(shot,t){return {x:shot.x+shot.vx*t,y:shot.y-shot.vy*t+TUNING.gravity*t*t/2};}
export function targetPosition(t,seed=0,reduced=false){
  if(reduced||t<TUNING.firstPause)return {x:.5,y:.34};
  const step=Math.floor((t-TUNING.firstPause)/TUNING.moveInterval);
  const f=clamp(((t-TUNING.firstPause)%TUNING.moveInterval)/TUNING.moveDuration,0,1);
  const destination=i=>i<0?.5:.27+((Math.sin((i+1)*91+seed)*43758.5453)%1+1)%1*.46;
  const isJump=i=>i>=0&&((Math.sin((i+1)*37+seed)*43758.5453)%1+1)%1>.65;
  const anchor=i=>{while(isJump(i))i--;return destination(i);};
  const jump=isJump(step);
  const x=jump?anchor(step-1):anchor(step-1)+(anchor(step)-anchor(step-1))*(f*f*(3-2*f));
  return {x:clamp(x,.2,.8),y:.34-(jump?Math.sin(Math.PI*f)*.13:0)};
}
// Segment vs ellipse in relative motion, returning the first contact fraction.
export function contact(a,b,ta,tb,rx=TUNING.radiusX+TUNING.ballRadius,ry=TUNING.radiusY+TUNING.ballRadius){
  const x=(a.x-ta.x)/rx,y=(a.y-ta.y)/ry,dx=((b.x-tb.x)/rx)-x,dy=((b.y-tb.y)/ry)-y;
  const c=x*x+y*y-1;if(c<=0)return 0;
  const q=dx*dx+dy*dy;if(!q)return null;
  const p=2*(x*dx+y*dy),d=p*p-4*q*c;if(d<0)return null;
  const u=(-p-Math.sqrt(d))/(2*q);return u>=0&&u<=1?u:null;
}
export function ringRatio(t,reduced=false){return reduced?.6:1-(t%TUNING.ringPeriod)/TUNING.ringPeriod*.85;}
export function gradeAt(distance,ratio){return distance>ratio?'basic':ratio>.6?'nice':ratio>.3?'great':'excellent';}
export const GRADE_NAMES={basic:'명중',nice:'나이스',great:'그레이트',excellent:'엑설런트'};
export function captureChance({ball,grade='basic',rarity='normal',first=false,misses=0}){
  if(ball==='master')return 1;
  return clamp(({normal:.65,uncommon:.60,rare:.45}[rarity]??.65)+({basic:0,nice:.05,great:.10,excellent:.15}[grade]??0)+BALLS[ball].bonus+(first?.15:0)+Math.min(2,misses)*.10,.10,.95);
}
export function outcome(throwRecord,encounter,grade=null){
  if(!grade)return {kind:'miss',grade:null,chance:0};
  const chance=captureChance({ball:throwRecord.ball,grade,rarity:encounter.pokemon.rarity,first:encounter.first,misses:encounter.misses});
  return {kind:throwRecord.random<chance?'caught':'escaped',grade,chance};
}
