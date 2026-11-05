const cache=new Map(), imageCache=new Map();
function loadImage(url){
 if(!imageCache.has(url))imageCache.set(url,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{imageCache.delete(url);reject(new Error(`숲속 오브젝트 로드 실패: ${url}`));};img.src=url;}));
 return imageCache.get(url);
}
export function loadScene(url){
 if(!cache.has(url))cache.set(url,(async()=>{
  const response=await fetch(url);if(!response.ok)throw new Error('장면 정보를 불러오지 못했어요. 다시 시도해 주세요.');
  const scene=await response.json();
  const base=new URL(url,location.href);
  scene.backgroundImage=await loadImage(new URL(scene.background,base).href);
  scene.objects=await Promise.all(scene.objects.map(async object=>{
   const image=await loadImage(new URL(object.asset,base).href);
   return {...object,image};
  }));return scene;
 })().catch(error=>{cache.delete(url);throw error;}));
 return cache.get(url);
}
export function drawObjects(ctx,scene,width,height,min,max){
 for(const object of [...scene.objects].sort((a,b)=>a.zIndex-b.zIndex)){
  if(object.hidden||object.zIndex<min||object.zIndex>max)continue;
  const w=object.width*object.scale*width,h=w*object.image.height/object.image.width;
  ctx.drawImage(object.image,object.x*width-w/2,object.y*height,w,h);
 }
}
