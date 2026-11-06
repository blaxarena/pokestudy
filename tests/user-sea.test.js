import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {validateLayout} from '../editor/model.js';import {placeLayoutPokemon} from '../src/modules/hidden-picture/layout-placement.js';import {levels} from '../src/modules/hidden-picture/placement.js';import {spriteSamples,measureOcclusion} from '../src/modules/hidden-picture/occlusion.js';
const read=file=>readFileSync(new URL(file,import.meta.url));const source=read('../public/assets/sea/scene-01/sea-wailord-layout.json'),manifestBytes=read('../asset-packages/sea-wailord-01/manifest.json');
const layout=JSON.parse(source),assets=new Map(JSON.parse(manifestBytes).assets.map(a=>[a.id,a]));const scene=JSON.parse(read('../public/assets/sea/scene-01/scene-layout-v1.json'));
test('sea uploaded 75-object layout retains every geometry, layer, opacity and flip field',()=>{assert.equal(layout.objects.length,75);assert.deepEqual(validateLayout(layout,assets,'sea-wailord-01').objects,layout.objects);assert.deepEqual(scene.logicalSize,layout.canvas);});
test('sea compiled slots match exact source layout and asset metadata',()=>{const sha=bytes=>createHash('sha256').update(bytes).digest('hex');assert.equal(scene.layoutSha256,sha(source));assert.equal(scene.manifestSha256,sha(manifestBytes));});
for(const level of Object.keys(levels)){
 test(`sea ${level}: all 24 variants obey occlusion, references, bounds and no-overlap constraints`,()=>{
  const variants=scene.variants[level];assert.equal(variants.length,24);assert.equal(new Set(variants.map(v=>JSON.stringify(v))).size,24);
  for(const row of variants){assert.equal(row.length,levels[level].total);assert.equal(new Set(row.map(s=>s.slotId)).size,row.length);assert.ok(row.filter(s=>s.occlusionRatio>=.025).length>=levels[level].targets);
   for(const s of row){const h=s.width*1672/941;assert.ok(s.x-s.width/2>=0&&s.y-h/2>=0&&s.x+s.width/2<=1&&s.y+h/2<=1);assert.ok(s.occlusionRatio<=s.maxOcclusionRatio&&s.maxOcclusionRatio<=.45);assert.ok(s.headOcclusionRatio<.17);for(const id of s.foregroundObjectIds)assert.ok(layout.objects.some(o=>o.id===id&&o.zIndex>s.zIndex));for(const other of row)if(s!==other)assert.ok(Math.abs(s.x-other.x)>=s.width||Math.abs(s.y-other.y)>=h);}
  }
 });
 test(`sea ${level}: 100 randomized rounds preserve exact species/target counts and distinct slots`,()=>{for(let i=0;i<100;i++){const pokemon=Array.from({length:levels[level].total},(_,id)=>({id,target:id<levels[level].targets}));const placed=placeLayoutPokemon(pokemon,level,scene.variants,1672,941);assert.equal(placed.length,levels[level].total);assert.equal(new Set(placed.map(p=>p.slotId)).size,placed.length);assert.equal(placed.filter(p=>p.target).length,levels[level].targets);}});
}
