import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rewardBall,rewardQuantity,swipe,ballPosition,targetPosition,contact,gradeAt,captureChance,outcome,ringRatio,defaultBall} from '../src/modules/capture/rules.js';
import {spriteCandidates} from '../src/modules/capture/sprites.js';

test('reward distribution boundaries: 70/20/9/1 without rerolls',()=>{
  for(const [r,key] of [[0,'normal'],[.699999,'normal'],[.7,'super'],[.899999,'super'],[.9,'hyper'],[.989999,'hyper'],[.99,'master'],[.999999,'master']])assert.equal(rewardBall(r),key);
});
test('reward quantity gives 1–3 equally sized random intervals with exact boundaries',()=>{
  for(const [r,n] of [[0,1],[1/3-1e-8,1],[1/3,2],[2/3-1e-8,2],[2/3,3],[.9999999,3]])assert.equal(rewardQuantity(r),n);
});
test('swipe rejects taps, downward and sideways; direction and power remain player controlled',()=>{
  const a={x:.5,y:.86,time:0};
  for(const b of [{x:.5,y:.85,time:100},{x:.5,y:.95,time:100},{x:.8,y:.75,time:100}])assert.equal(swipe(a,b),null);
  const left=swipe(a,{x:.4,y:.6,time:200}),right=swipe(a,{x:.6,y:.6,time:200});
  assert.ok(left.vx<0&&right.vx>0);assert.ok(ballPosition(left,.5).x<.5);assert.ok(ballPosition(right,.5).x>.5);
  assert.notEqual(swipe(a,{x:.5,y:.76,time:800}).vy,swipe(a,{x:.5,y:.5,time:100}).vy);
});
test('a natural centered throw hits a resting target; a diagonal throw misses',()=>{
  const a={x:.5,y:.86,time:0};
  const center=swipe(a,{x:.5,y:.60,time:200});
  let hit=false;
  for(let t=0;t<1.5;t+=.1)if(contact(ballPosition(center,t),ballPosition(center,t+.1),{x:.5,y:.34},{x:.5,y:.34})!==null)hit=true;
  assert.ok(hit);
  const diagonal=swipe(a,{x:.72,y:.6,time:200});hit=false;
  for(let t=0;t<1.5;t+=.1)if(contact(ballPosition(diagonal,t),ballPosition(diagonal,t+.1),{x:.5,y:.34},{x:.5,y:.34})!==null)hit=true;
  assert.equal(hit,false);
});
test('relative swept collision catches fast balls and moving targets between frames',()=>{
  assert.notEqual(contact({x:.5,y:.9},{x:.5,y:.1},{x:.3,y:.5},{x:.7,y:.5}),null);
  // This off-center crossing hit the old larger box, but misses the reduced box.
  assert.equal(contact({x:.5,y:.9},{x:.5,y:.1},{x:.3,y:.35},{x:.7,y:.35}),null);
  assert.equal(contact({x:.1,y:.9},{x:.1,y:.1},{x:.5,y:.35},{x:.5,y:.35}),null);
  assert.equal(contact({x:.5,y:.35},{x:.5,y:.35},{x:.5,y:.35},{x:.5,y:.35}),0);
});
test('ring grades include exact 60% and 30% boundaries and outside hits',()=>{
  assert.equal(gradeAt(.8,.6),'basic');assert.equal(gradeAt(.1,.60001),'nice');
  assert.equal(gradeAt(.1,.6),'great');assert.equal(gradeAt(.1,.30001),'great');assert.equal(gradeAt(.1,.3),'excellent');
  assert.equal(ringRatio(40,true),.6);
});
test('all rarity, ball, grade and pity modifiers with 95% cap',()=>{
  assert.equal(captureChance({ball:'normal'}),.65);
  assert.equal(captureChance({ball:'super'}),.75);
  assert.ok(Math.abs(captureChance({ball:'hyper'})-.85)<1e-10);
  assert.equal(captureChance({ball:'normal',rarity:'uncommon'}),.6);
  assert.equal(captureChance({ball:'normal',rarity:'rare'}),.45);
  assert.ok(Math.abs(captureChance({ball:'super',rarity:'rare'})-.55)<1e-10);
  assert.ok(Math.abs(captureChance({ball:'hyper',rarity:'rare'})-.65)<1e-10);
  assert.equal(captureChance({ball:'normal',first:true,grade:'excellent',misses:100}),.95);
  assert.equal(captureChance({ball:'normal',rarity:'rare',misses:100}),.65);
  assert.equal(captureChance({ball:'master',rarity:'rare'}),1);
});
test('stored RNG is strict at probability boundary; master needs a hit',()=>{
  const e={pokemon:{},first:false,misses:0};
  assert.equal(outcome({ball:'normal',random:.64999},e,'basic').kind,'caught');
  assert.equal(outcome({ball:'normal',random:.65},e,'basic').kind,'escaped');
  assert.equal(outcome({ball:'master',random:.99999},e,'basic').kind,'caught');
  assert.equal(outcome({ball:'master',random:0},e).kind,'miss');
  for(const ball of ['normal','super','hyper']){const chance=captureChance({ball,grade:'great'});assert.equal(outcome({ball,random:chance-.00001},e,'great').kind,'caught');assert.equal(outcome({ball,random:chance},e,'great').kind,'escaped');}
});
test('selected exhausted ball falls back to lowest owned grade',()=>{
  assert.equal(defaultBall({normal:0,super:1,hyper:2,master:0},'master'),'super');
  assert.equal(defaultBall({normal:1,super:1,hyper:2,master:0},'hyper'),'hyper');
});
test('movement has first pause, bounded destinations and stationary reduced motion',()=>{
  assert.deepEqual(targetPosition(4.9,3),{x:.5,y:.34});
  for(let t=0;t<100;t+=.07){const p=targetPosition(t,3);assert.ok(p.x>=.2&&p.x<=.8&&p.y>=.20&&p.y<=.34);}
  for(let t=5;t<100;t+=3){const before=targetPosition(t-.00001,3),after=targetPosition(t+.00001,3);assert.ok(Math.abs(before.x-after.x)<.001);}
  assert.deepEqual(targetPosition(100,3,true),{x:.5,y:.34});
});
test('sprite candidate ordering, missing fields and reduced motion',()=>{
  const data={sprites:{front_default:'still',other:{showdown:{front_default:'animated'},'official-artwork':{front_default:'art'}},versions:{'generation-v':{'black-white':{animated:{front_default:'bw'}}}}}};
  assert.deepEqual(spriteCandidates(data),['animated','bw','still','art']);
  assert.deepEqual(spriteCandidates(data,true),['still','art']);
  assert.deepEqual(spriteCandidates({}),[]);
});
