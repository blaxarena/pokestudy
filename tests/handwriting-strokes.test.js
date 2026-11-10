import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadStrokeData,loadWordStrokes} from '../src/modules/handwriting/stroke-data.js';

test('basic consonants and vowels follow teaching stroke counts, including print-form ㅈ/ㅊ',async()=>{
  const counts={'ㄱ':1,'ㄴ':1,'ㄷ':2,'ㄹ':3,'ㅁ':3,'ㅂ':4,'ㅅ':2,'ㅇ':1,'ㅈ':3,'ㅊ':4,'ㅋ':2,'ㅌ':3,'ㅍ':4,'ㅎ':3,'ㅏ':2,'ㅑ':3,'ㅓ':2,'ㅕ':3,'ㅗ':2,'ㅛ':3,'ㅜ':2,'ㅠ':3,'ㅡ':1,'ㅣ':1};
  for(const [character,count] of Object.entries(counts))assert.equal((await loadStrokeData(character)).strokes.length,count,character);
});
test('familiar Pokemon names compose initial, vowel and final strokes',async()=>{
  const pika=await loadWordStrokes('피카츄');assert.deepEqual(pika.map(l=>l.data.strokes.length),[5,4,7]);
  const bulba=await loadWordStrokes('이상해씨');assert.deepEqual(bulba.map(l=>l.data.strokes.length),[2,5,6,5]);
  for(const letter of [...pika,...bulba]){
    assert.equal(letter.data.strokes.length,letter.data.medians.length);
    for(const points of letter.data.medians){assert.ok(points.length>=2);for(const [x,y] of points)assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1024&&y>=-124&&y<=900);}
  }
});
test('compound vowels, double consonants and double finals compose valid data',async()=>{
  for(const character of '까똬뻐쐬쫘괜꿩읊값읽힣'){const d=await loadStrokeData(character);assert.ok(d.strokes.length>0,character);assert.equal(d.strokes.length,d.medians.length);}
});
test('NFC combines decomposed Hangul, while digits and symbols have no fabricated strokes',async()=>{
  const letters=await loadWordStrokes('피카츄2♀');assert.deepEqual(letters.map(l=>l.character),['피','카','츄','2','♀']);
  assert.equal(letters[3].data,null);assert.equal(letters[4].data,null);assert.equal(await loadStrokeData('Z'),null);
});
test('basic directions preserve left-to-right and top-to-bottom order',async()=>{
  const a=await loadStrokeData('ㅏ');assert.ok(a.medians[0][0][1]>a.medians[0].at(-1)[1]);assert.ok(a.medians[1][0][0]<a.medians[1].at(-1)[0]);
  const n=await loadStrokeData('ㄴ');assert.ok(n.medians[0][0][1]>n.medians[0].at(-1)[1]);assert.ok(n.medians[0][0][0]<n.medians[0].at(-1)[0]);
});
