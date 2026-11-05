export const levels={easy:{total:12,targets:4},normal:{total:25,targets:8},hard:{total:45,targets:12}};
export function shuffle(items,random=Math.random){
 const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
export function placePokemon(pokemon,level,slots,width=3840,height=2160,random=Math.random){
 const available=slots??Array.from({length:45},(_,i)=>({slotId:`fallback-${i}`,x:.07+i%9*.1075,y:.18+Math.floor(i/9)*.17,scaleRange:[.9,1],difficulty:['easy','normal','hard']}));
 const selected=shuffle(available.filter(s=>s.difficulty.includes(level)),random);
 if(new Set(pokemon.map(p=>p.id)).size!==pokemon.length)throw new Error('동일 종 중복 배치');
 if(selected.length<pokemon.length)throw new Error('은신 슬롯 부족');
 return pokemon.map((p,i)=>{
  const slot=selected[i],scale=slot.scaleRange[0]+random()*(slot.scaleRange[1]-slot.scaleRange[0]);
  const size=({easy:.085,normal:.076,hard:.059}[level])*scale;
  return {...p,slotId:slot.slotId,nx:slot.x,ny:slot.y,x:(slot.x-size/2)*width,y:slot.y*height-size*width/2,w:size*width,h:size*width};
 });
}
