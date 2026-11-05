import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {placePokemon,levels} from '../src/modules/hidden-picture/placement.js';
const scene=JSON.parse(readFileSync(new URL('../public/assets/forest/scene-01/scene.json',import.meta.url)));
for(const level of Object.keys(levels))test(`${level}: count, unique slots, bounds, no overlaps over 100 games`,()=>{
 for(let n=0;n<100;n++){
  const pool=Array.from({length:levels[level].total},(_,id)=>({id,target:id<levels[level].targets}));
  const p=placePokemon(pool,level,scene.slots);
  assert.equal(p.length,levels[level].total);assert.equal(p.filter(x=>x.target).length,levels[level].targets);assert.equal(new Set(p.map(x=>x.slotId)).size,p.length);
  for(const a of p){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=3840&&a.y+a.h<=2160);for(const b of p)if(a!==b)assert.ok(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);}
 }
});
test('invalid duplicate species rejected',()=>assert.throws(()=>placePokemon([{id:1},{id:1}],'easy',scene.slots)));
test('all slot occluders exist',()=>{for(const slot of scene.slots){assert.ok(slot.maxOcclusionRatio<=.45);for(const id of slot.foregroundObjectIds)assert.ok(scene.objects.some(o=>o.id===id));}});
import {hitTest} from '../src/modules/hidden-picture/hit-test.js';
for(const [width,height] of [[3840,2160],[1180,664],[768,432],[390,219]])test(`touch coordinates at ${width}x${height}`,()=>{
 const item={id:1,target:true,x:1000,y:700,w:200,h:200};const rect={left:30,top:80,width,height};
 assert.equal(hitTest([item],new Set(),30+1100/3840*width,80+800/2160*height,rect,3840,2160)?.id,1);
 assert.equal(hitTest([item],new Set([1]),30+1100/3840*width,80+800/2160*height,rect,3840,2160),undefined);
});
