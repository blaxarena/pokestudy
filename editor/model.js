export const WIDTH = 1672, HEIGHT = 941, MAX_OBJECTS = 200;
export const createLayout = (sceneId='forest-01') => ({version:1,sceneId,canvas:{width:WIDTH,height:HEIGHT},background:'background',objects:[]});
export function objectSize(object,asset){
 const box=asset.visibleBounds??[0,0,asset.width,asset.height];
 return {width:object.width,height:object.width*WIDTH/HEIGHT*(box[3]-box[1])/(box[2]-box[0])};
}
export function constrain(object,asset){
 const ratio=objectSize({...object,width:1},asset).height;
 const width=Math.max(.02,Math.min(object.width,1,1/ratio));
 const height=width*ratio;
 return {...object,width,x:Math.max(0,Math.min(1-width,object.x)),y:Math.max(0,Math.min(1-height,object.y))};
}
export function scenePoint(clientX,clientY,rect){return {x:(clientX-rect.left)/rect.width,y:(clientY-rect.top)/rect.height};}
export function ordered(objects){return [...objects].sort((a,b)=>a.zIndex-b.zIndex);}
export function validateLayout(input,assets,sceneId='forest-01'){
 const fail=()=>{throw new Error('선택한 테마의 배치 JSON 형식을 확인해 주세요.');};
 if(!input||input.version!==1||input.sceneId!==sceneId||input.background!=='background'||input.canvas?.width!==WIDTH||input.canvas?.height!==HEIGHT||!Array.isArray(input.objects)||input.objects.length>MAX_OBJECTS)fail();
 const ids=new Set();
 const objects=input.objects.map((o,index)=>{
  if(!o||typeof o.id!=='string'||!o.id||o.id.length>100||ids.has(o.id)||!assets.has(o.assetId)||!assets.get(o.assetId).transparent)fail();
  ids.add(o.id);
  if(!['x','y','width','zIndex'].every(k=>Number.isFinite(o[k]))||o.x<0||o.x>1||o.y<0||o.y>1||o.width<.02||o.width>1||!Number.isInteger(o.zIndex)||Math.abs(o.zIndex)>10000)fail();
  if(typeof o.hidden!=='boolean'||typeof o.flipX!=='boolean'||!Number.isFinite(o.opacity)||o.opacity<.2||o.opacity>1)fail();
  return constrain({id:o.id,assetId:o.assetId,x:o.x,y:o.y,width:o.width,zIndex:o.zIndex,hidden:o.hidden,flipX:o.flipX,opacity:o.opacity},assets.get(o.assetId));
 });
 return {...createLayout(sceneId),objects:ordered(objects).map((o,index)=>({...o,zIndex:index}))};
}
