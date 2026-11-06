import {shuffle,levels} from './placement.js';
export function placeLayoutPokemon(pokemon,level,variants,width,height,random=Math.random){
 if(!levels[level]||pokemon.length!==levels[level].total)throw new Error('난이도에 맞는 포켓몬 수를 확인해 주세요.');
 if(new Set(pokemon.map(p=>p.id)).size!==pokemon.length)throw new Error('동일 종 중복 배치');
 const choices=variants[level];if(!choices?.length)throw new Error('장면 은신 위치를 불러오지 못했어요.');
 const chosen=choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
 const covered=shuffle(chosen.filter(s=>s.occlusionRatio>=.025),random),open=shuffle(chosen.filter(s=>s.occlusionRatio<.025),random);
 const targetCount=pokemon.filter(p=>p.target).length,targetSlots=shuffle([...covered,...open].slice(0,targetCount),random),used=new Set(targetSlots.map(s=>s.slotId));
 const otherSlots=shuffle(chosen.filter(s=>!used.has(s.slotId)),random);
 return pokemon.map(p=>{const slot=(p.target?targetSlots:otherSlots).pop();if(!slot)throw new Error('은신 슬롯 부족');const size=slot.width*width;return {...p,slotId:slot.slotId,x:slot.x*width-size/2,y:slot.y*height-size/2,w:size,h:size,zIndex:slot.zIndex,maxOcclusionRatio:slot.maxOcclusionRatio};});
}
