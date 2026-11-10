import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acceptsDrawingPointer} from '../src/modules/handwriting/pen-input.js';
test('automatic mode allows fingers until a pen is actually observed',()=>{
  for(const type of ['touch','mouse','pen'])assert.equal(acceptsDrawingPointer('auto',false,type),true);
  assert.equal(acceptsDrawingPointer('auto',true,'pen'),true);
  for(const type of ['touch','mouse',''])assert.equal(acceptsDrawingPointer('auto',true,type),false);
});
test('explicit pen-only mode blocks fingers before the first pen stroke',()=>{
  assert.equal(acceptsDrawingPointer('pen',false,'pen'),true);
  for(const type of ['touch','mouse',''])assert.equal(acceptsDrawingPointer('pen',false,type),false);
});
test('all-input mode lets the user restore touch and mouse after pen detection',()=>{
  for(const type of ['pen','touch','mouse'])assert.equal(acceptsDrawingPointer('all',true,type),true);
});
