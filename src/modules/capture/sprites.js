export const FALLBACK=new URL('./fallback.svg',import.meta.url).href;
const pending=new Map(),apiPending=new Map(),responses=new Map(),successes=new Map();
const cacheGet=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const cachePut=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Image cache is optional. */}};
async function json(url,timeout=2500){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('API');return await response.json();}finally{clearTimeout(timer);}
}
export function spriteCandidates(data,reduced=false){
  const s=data?.sprites||{},staticUrls=[s.front_default,s.other?.['official-artwork']?.front_default];
  const animated=[s.other?.showdown?.front_default,s.versions?.['generation-v']?.['black-white']?.animated?.front_default];
  return [...new Set((reduced?staticUrls:[...animated,...staticUrls]).filter(Boolean))];
}
export function loadImage(url,timeout=1800){
  return new Promise((resolve,reject)=>{
    const image=new Image();let finished=false;
    const finish=(error)=>{if(finished)return;finished=true;clearTimeout(timer);image.onload=image.onerror=null;error?reject(error):resolve(image);};
    const timer=setTimeout(()=>finish(new Error('이미지 시간 초과')),timeout);
    image.onload=async()=>{try{if(image.decode)await image.decode();if(!image.naturalWidth)throw new Error('이미지 없음');finish();}catch(e){finish(e);}};
    image.onerror=()=>finish(new Error('이미지 실패'));image.crossOrigin='anonymous';image.src=url;
  });
}
function visibleBounds(image){
  try{
    const scale=Math.min(1,256/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<left)return null;
    return {x:left/canvas.width,y:top/canvas.height,w:(right-left+1)/canvas.width,h:(bottom-top+1)/canvas.height,aspect:image.naturalWidth/image.naturalHeight};
  }catch{return {x:0,y:0,w:1,h:1,aspect:image.naturalWidth/image.naturalHeight};}
}
async function apiData(id){
  if(responses.has(id))return responses.get(id);
  if(apiPending.has(id))return apiPending.get(id);
  const task=fetchData(id).finally(()=>apiPending.delete(id));apiPending.set(id,task);return task;
}
async function fetchData(id){
  const key=`capture-api-${id}`;let data;
  try{data=await json(`https://pokeapi.co/api/v2/pokemon/${id}/`);responses.set(id,data);cachePut(key,data);}catch{data=cacheGet(key);}
  return data;
}
export function loadSprite(pokemon,reduced=false){
  const key=`${pokemon.id}:${reduced}`;
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{
    const data=await apiData(pokemon.id);
    let name=pokemon.name||cacheGet(`pokedex-ko-species-${pokemon.id}`)?.name;
    if(!name){try{name=(await json(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}/`)).names?.find(n=>n.language.name==='ko')?.name;}catch{}}
    const saved=successes.get(key)||cacheGet(`capture-image-${key}`);
    const candidates=spriteCandidates(data,reduced);
    // Keep the documented candidate order on the first request; reuse a decoded winner.
    const reusable=saved&&(!reduced||[...candidates,pokemon.fallback,pokemon.image].includes(saved));
    const urls=[...(reusable?[saved]:[]),...candidates,pokemon.fallback,pokemon.image,FALLBACK].filter(Boolean);
    for(const url of [...new Set(urls)]){
      try{const image=await loadImage(url);const bounds=visibleBounds(image);if(!bounds)throw new Error('투명한 이미지');if(url!==FALLBACK){successes.set(key,url);cachePut(`capture-image-${key}`,url);}return {url,name:name||`포켓몬 ${pokemon.id}`,fallback:url===FALLBACK,bounds};}catch{}
    }
    return {url:FALLBACK,name:name||`포켓몬 ${pokemon.id}`,fallback:true};
  })().finally(()=>pending.delete(key));
  pending.set(key,task);return task;
}
