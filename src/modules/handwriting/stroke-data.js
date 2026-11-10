import HangulWriter from '../../vendor/hangul-writer/index.esm.js';

const pending=new Map();
export const isSupportedHangul=character=>/^[가-힣ㄱ-ㅎㅏ-ㅣ]$/u.test(character);
// The bundled data uses initial → vowel → final order, including compound jamo.
export function loadStrokeData(character){
  if(!isSupportedHangul(character))return Promise.resolve(null);
  if(!pending.has(character))pending.set(character,HangulWriter.loadCharacterData(character).then(data=>{
    if(!data?.strokes?.length||data.strokes.length!==data.medians?.length)throw new Error('획순 데이터를 읽지 못했어요.');
    return data;
  }).catch(error=>{pending.delete(character);throw error;}));
  return pending.get(character);
}
export async function loadWordStrokes(name){
  const characters=Array.from(name.normalize('NFC'));
  return Promise.all(characters.map(async(character,index)=>({character,index,data:await loadStrokeData(character)})));
}
