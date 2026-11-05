import {validateLayout,objectSize} from '../../../editor/model.js';
import {spriteSamples,measureOcclusion} from './occlusion.js';
const sceneCache=new Map(),imageCache=new Map();
async function getJSON(url){const response=await fetch(url);if(!response.ok)throw new Error('배치한 숲속 장면을 불러오지 못했어요. 다시 시도해 주세요.');return response.json();}
function loadImage(url){
 if(!imageCache.has(url))imageCache.set(url,new Promise((resolve,reject)=>{const im=new Image();const timer=setTimeout(()=>{im.onload=im.onerror=null;reject(new Error('숲속 에셋 로딩이 지연되고 있어요. 다시 시도해 주세요.'));},20000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(new Error('숲속 에셋을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.'));};im.src=url;}).catch(error=>{imageCache.delete(url);throw error;}));
 return imageCache.get(url);
}
export function loadLayoutScene(url){
 if(!sceneCache.has(url))sceneCache.set(url,(async()=>{
  const config=await getJSON(url),base=new URL(url,location.href),manifestURL=new URL(config.assetManifest,base);
  const [source,manifest]=await Promise.all([getJSON(new URL(config.layout,base)),getJSON(manifestURL)]);
  const assets=new Map(manifest.assets.map(a=>[a.id,a]));const layout=validateLayout(source,assets);
  const [backgroundImage,objects]=await Promise.all([loadImage(new URL(assets.get(layout.background).file,manifestURL).href),Promise.all(layout.objects.map(async o=>({...o,metadata:assets.get(o.assetId),image:await loadImage(new URL(assets.get(o.assetId).file,manifestURL).href)})))]);
  const scene={...config,layout,assets,backgroundImage,objects};scene.foregroundMasks=buildMasks(scene);return scene;
 })().catch(error=>{sceneCache.delete(url);throw error;}));
 return sceneCache.get(url);
}
export function drawLayoutObject(ctx,object,width,height){
 if(object.hidden)return;const b=object.metadata.visibleBounds,size=objectSize(object,object.metadata),w=size.width*width,h=size.height*height;
 ctx.save();ctx.globalAlpha=object.opacity;ctx.translate(object.x*width+(object.flipX?w:0),object.y*height);ctx.scale(object.flipX?-1:1,1);ctx.drawImage(object.image,b[0],b[1],b[2]-b[0],b[3]-b[1],0,0,w,h);ctx.restore();
}
// Sample alpha numerically rather than shrinking artwork on a canvas. Canvas
// minification can populate shared image mipmaps and change a later drawing.
const alphaCache=new WeakMap();
function sourceAlpha(image){
 if(alphaCache.has(image))return alphaCache.get(image);
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,width=Math.ceil(canvas.width/2),height=Math.ceil(canvas.height/2),data=new Uint8Array(width*height),originalWidth=canvas.width,originalHeight=canvas.height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let sum=0,count=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const sx=x*2+dx,sy=y*2+dy;if(sx<originalWidth&&sy<originalHeight){sum+=rgba[(sy*originalWidth+sx)*4+3];count++;}}data[y*width+x]=Math.round(sum/count);}
 canvas.width=canvas.height=0;const result={data,width,height};alphaCache.set(image,result);return result;
}
function buildMasks(scene){
 const width=418,height=235,masks=new Array(scene.objects.length+1);masks[masks.length-1]=new Uint8Array(width*height);
 for(let i=scene.objects.length-1;i>=0;i--){
  const object=scene.objects[i],previous=masks[i+1],mask=previous.slice();masks[i]=mask;if(object.hidden)continue;
  const alpha=sourceAlpha(object.image),box=object.metadata.visibleBounds,size=objectSize(object,object.metadata);
  const left=Math.max(0,Math.floor(object.x*width)),right=Math.min(width,Math.ceil((object.x+size.width)*width)),top=Math.max(0,Math.floor(object.y*height)),bottom=Math.min(height,Math.ceil((object.y+size.height)*height));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   let u=((x+.5)/width-object.x)/size.width;const v=((y+.5)/height-object.y)/size.height;if(u<0||u>1||v<0||v>1)continue;if(object.flipX)u=1-u;
   const fx=(box[0]+u*(box[2]-box[0]))/2-.5,fy=(box[1]+v*(box[3]-box[1]))/2-.5;
   const bx=Math.floor(fx),by=Math.floor(fy),tx=fx-bx,ty=fy-by;
   const read=(sx,sy)=>alpha.data[Math.max(0,Math.min(alpha.height-1,sy))*alpha.width+Math.max(0,Math.min(alpha.width-1,sx))];
   const value=((read(bx,by)*(1-tx)+read(bx+1,by)*tx)*(1-ty)+(read(bx,by+1)*(1-tx)+read(bx+1,by+1)*tx)*ty)/255*object.opacity;
   mask[y*width+x]=Math.round(value*255+previous[y*width+x]*(1-value));
  }
 }
 return {width,height,masks};
}

export function refinePlacements(scene,pokemon,images,level,width,height){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const ctx=canvas.getContext('2d',{willReadFrequently:true});const {masks,width:mw,height:mh}=scene.foregroundMasks;const headLimit={easy:.12,normal:.18,hard:.22}[level];
 return pokemon.map(p=>{
  ctx.clearRect(0,0,48,48);ctx.drawImage(images.get(p.id),0,0,48,48);const points=spriteSamples(ctx.getImageData(0,0,48,48));
  let index=scene.objects.findIndex(o=>o.zIndex>p.zIndex);if(index<0)index=scene.objects.length;let score;
  do{score=measureOcclusion(points,p,masks[index],mw,mh,width,height);if(score.body<=p.maxOcclusionRatio&&score.head<=headLimit)break;index++;}while(index<masks.length);
  const zIndex=index<scene.objects.length?scene.objects[index].zIndex-.5:(scene.objects.at(-1)?.zIndex??-.5)+.5;
  return {...p,zIndex,occlusionRatio:score.body,headOcclusionRatio:score.head};
 });
}
export function paintLayoutScene(ctx,scene,pokemon,images,width,height){
 ctx.clearRect(0,0,width,height);ctx.drawImage(scene.backgroundImage,0,0,width,height);
 const entries=[...scene.objects.map(object=>({z:object.zIndex,object})),...pokemon.map(p=>({z:p.zIndex,p}))].sort((a,b)=>a.z-b.z);
 for(const entry of entries){if(entry.object)drawLayoutObject(ctx,entry.object,width,height);else{const p=entry.p;ctx.drawImage(images.get(p.id),p.x,p.y,p.w,p.h);}}
}
