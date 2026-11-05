import {WIDTH,HEIGHT,MAX_OBJECTS,createLayout,objectSize,constrain,scenePoint,ordered,validateLayout} from './model.js';
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d');
const manifestURL=new URL('../asset-packages/forest-01/manifest.json',import.meta.url);
const STORE='pokestudy-forest-editor-v1';
const labels={'tree-hollow':'구멍 있는 큰 나무','tree-branching':'가지가 뻗은 나무','tree-small':'작은 나무','tree-round':'둥근 나무','tree-wide':'넓게 퍼진 나무','bridge':'나무다리','log':'통나무','stump':'그루터기','mushroom-large':'큰 버섯','mushroom-small':'작은 버섯','rock-moss':'이끼 바위','rock-round':'둥근 바위','rock-cave':'구멍 바위','grass-wide':'넓은 잎 풀','grass-tall':'키 큰 풀','grass-short':'낮은 풀','grass-sparse':'성긴 풀','grass-reeds':'물가 풀','grass-curled':'굽은 잎 풀','bush-round':'둥근 수풀','bush-wide':'넓은 수풀','bush-yellow':'노란 꽃 수풀','bush-white':'흰 꽃 수풀','bush-light':'밝은 수풀','flowers-pink':'분홍 꽃','flowers-purple':'보라 꽃','flowers-yellow':'노란 꽃','flowers-white':'흰 꽃','flowers-tall-pink':'키 큰 분홍 꽃','flowers-mixed':'분홍·노란 꽃','fern-spread':'퍼진 고사리','fern-upright':'곧은 고사리','plant-broadleaf':'큰 잎 식물','plant-berries':'빨간 열매','vine':'덩굴'};
let assets=new Map(),images=new Map(),layout=createLayout(),selectedId=null,past=[],future=[],gesture=null,rangeBase=null,ready=false,busy=false,saveTimer,dirty=false;
const clone=value=>JSON.parse(JSON.stringify(value));
const selected=()=>layout.objects.find(o=>o.id===selectedId);
const snapshot=()=>({layout:clone(layout),selectedId});
const say=text=>$('status').textContent=text;
function setBusy(value){busy=value;$('loading').hidden=!value;canvas.setAttribute('aria-busy',String(value));}
async function loadAsset(id){
 if(!images.has(id))images.set(id,(async()=>{
  const asset=assets.get(id);if(!asset)throw Error('알 수 없는 에셋이에요.');
  const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error(`${labels[id]??'배경'} 이미지를 불러오지 못했어요. 다시 시도해 주세요.`));im.src=new URL(asset.file,manifestURL).href;});
  let alpha=null;
  if(asset.transparent){const scratch=document.createElement('canvas');scratch.width=image.naturalWidth;scratch.height=image.naturalHeight;const c=scratch.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const data=c.getImageData(0,0,scratch.width,scratch.height).data;alpha=new Uint8Array(scratch.width*scratch.height);for(let i=0;i<alpha.length;i++)alpha[i]=data[i*4+3];}
  const result={image,alpha};images.set(id,result);return result;
 })().catch(error=>{images.delete(id);throw error;}));
 return await images.get(id);
}
function rectOf(o){const s=objectSize(o,assets.get(o.assetId));return {x:o.x*WIDTH,y:o.y*HEIGHT,w:s.width*WIDTH,h:s.height*HEIGHT};}
function drawScene(context,selection=true){
 context.clearRect(0,0,WIDTH,HEIGHT);const bg=images.get('background');if(bg?.image)context.drawImage(bg.image,0,0,WIDTH,HEIGHT);
 for(const o of ordered(layout.objects)){
  if(o.hidden)continue;const entry=images.get(o.assetId);if(!entry?.image)continue;
  const asset=assets.get(o.assetId),box=asset.visibleBounds??[0,0,asset.width,asset.height],r=rectOf(o);
  context.save();context.globalAlpha=o.opacity;context.translate(r.x+(o.flipX?r.w:0),r.y);context.scale(o.flipX?-1:1,1);context.drawImage(entry.image,box[0],box[1],box[2]-box[0],box[3]-box[1],0,0,r.w,r.h);context.restore();
 }
 if(selection&&selected()){
  const o=selected(),r=rectOf(o),scale=WIDTH/(canvas.getBoundingClientRect().width||WIDTH),handle=12*scale;
  context.save();context.strokeStyle='#fff';context.lineWidth=4*scale;context.strokeRect(r.x,r.y,r.w,r.h);context.strokeStyle='#216dcc';context.lineWidth=2*scale;context.setLineDash(o.hidden?[6*scale,4*scale]:[]);context.strokeRect(r.x,r.y,r.w,r.h);context.setLineDash([]);context.fillStyle='#216dcc';context.fillRect(r.x+r.w-handle/2,r.y+r.h-handle/2,handle,handle);context.strokeStyle='white';context.lineWidth=scale;context.strokeRect(r.x+r.w-handle/2,r.y+r.h-handle/2,handle,handle);context.restore();
 }
}
function paint(){if(ready)drawScene(ctx);}
function flushSave(){
 clearTimeout(saveTimer);if(!dirty)return;
 try{localStorage.setItem(STORE,JSON.stringify(layout));dirty=false;$('storageStatus').textContent='이 브라우저에 자동 저장됨 · 다른 기기에서는 저장한 JSON 파일을 불러오세요.';}catch{$('storageStatus').textContent='브라우저 자동 저장을 사용할 수 없어요. 배치 JSON 저장으로 파일을 보관해 주세요.';}
}
function queueSave(){dirty=true;clearTimeout(saveTimer);$('storageStatus').textContent='배치를 자동 저장하는 중…';saveTimer=setTimeout(flushSave,350);}
window.addEventListener('pagehide',flushSave);
document.addEventListener('visibilitychange',()=>{if(document.hidden)flushSave();});

function remember(before){
 layout.objects=ordered(layout.objects).map((o,index)=>({...o,zIndex:index}));
 if(JSON.stringify(before.layout)===JSON.stringify(layout))return;
 past.push(before);if(past.length>60)past.shift();future=[];queueSave();
}
function updateUI(){
 const o=selected();$('objectControls').disabled=!o;$('selectionName').textContent=o?(labels[o.assetId]??o.assetId):'그림 속 에셋이나 아래 배치 목록을 선택하세요.';
 $('undo').disabled=!past.length;$('redo').disabled=!future.length;$('clear').disabled=!layout.objects.length;
 if(o){$('size').max=Math.min(100,100/objectSize({...o,width:1},assets.get(o.assetId)).height);$('size').value=o.width*100;$('sizeValue').value=`${(o.width*100).toFixed(1)}%`;$('opacity').value=o.opacity*100;$('opacityValue').value=`${Math.round(o.opacity*100)}%`;$('toggleHidden').textContent=o.hidden?'다시 보이기':'숨기기';const sorted=ordered(layout.objects),i=sorted.findIndex(x=>x.id===o.id);$('forward').disabled=i===sorted.length-1;$('backward').disabled=i===0;}
 $('objectCount').textContent=`${layout.objects.length}개`;
 $('layerList').replaceChildren();
 for(const item of ordered(layout.objects).reverse()){
  const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.textContent=`${item.hidden?'숨김 · ':''}${labels[item.assetId]??item.assetId}`;button.setAttribute('aria-pressed',String(item.id===selectedId));button.classList.toggle('muted',item.hidden);button.dataset.objectId=item.id;button.onclick=()=>{if(busy)return;finishRange();selectedId=item.id;updateUI();paint();};li.append(button);$('layerList').append(li);
 }
 paint();
}
function change(action){if(!ready||busy)return;finishRange();const before=snapshot();action();remember(before);updateUI();}
function finishRange(){if(rangeBase){remember(rangeBase);rangeBase=null;}}
function patchSelected(patch){const o=selected();if(!o)return;Object.assign(o,constrain({...o,...patch},assets.get(o.assetId)));}
function undo(){if(!ready||busy)return;finishRange();if(!past.length)return;future.push(snapshot());const before=past.pop();layout=before.layout;selectedId=before.selectedId;updateUI();queueSave();say('이전 배치로 되돌렸어요.');}
function redo(){if(!ready||busy)return;finishRange();if(!future.length)return;past.push(snapshot());const after=future.pop();layout=after.layout;selectedId=after.selectedId;updateUI();queueSave();say('배치를 다시 실행했어요.');}
async function addAsset(assetId,point={x:.5,y:.55}){
 if(!ready||busy)return;if(layout.objects.length>=MAX_OBJECTS){say(`한 장면에 최대 ${MAX_OBJECTS}개까지 놓을 수 있어요.`);return;}
 setBusy(true);say(`${labels[assetId]} 불러오는 중…`);
 try{await loadAsset(assetId);setBusy(false);change(()=>{const asset=assets.get(assetId),width=asset.category==='trees' ? .23 : asset.category==='props' ? .20 : .15;const temp={id:crypto.randomUUID(),assetId,x:point.x,y:point.y,width,zIndex:Math.max(-1,...layout.objects.map(o=>o.zIndex))+1,opacity:1,flipX:false,hidden:false};const size=objectSize(temp,asset);const object=constrain({...temp,x:point.x-size.width/2,y:point.y-size.height/2},asset);layout.objects.push(object);selectedId=object.id;});say(`${labels[assetId]}을 놓았어요. 그림에서 끌어 위치를 바꿔 보세요.`);}catch(e){say(e.message);}finally{setBusy(false);}
}
function palette(){
 const category=$('category').value;$('assetList').replaceChildren();
 for(const asset of assets.values()){
  if(!asset.transparent||(category!=='all'&&asset.category!==category))continue;
  const button=document.createElement('button'),image=document.createElement('img'),label=document.createElement('span');button.className='asset-button';button.dataset.assetId=asset.id;button.type='button';button.draggable=true;button.title='눌러 추가하거나 배경으로 끌어 놓으세요';image.src=new URL(asset.file,manifestURL).href;image.alt='';image.loading='lazy';image.draggable=false;label.textContent=labels[asset.id]??asset.id;button.append(image,label);button.onclick=()=>addAsset(asset.id);button.ondragstart=e=>{if(busy){e.preventDefault();return;}e.dataTransfer.setData('application/x-pokestudy-asset',asset.id);e.dataTransfer.effectAllowed='copy';};$('assetList').append(button);
 }
}
function hit(point){
 for(const o of ordered(layout.objects).reverse()){
  if(o.hidden)continue;const r=rectOf(o),px=point.x*WIDTH,py=point.y*HEIGHT;
  if(px<r.x||px>r.x+r.w||py<r.y||py>r.y+r.h)continue;
  const entry=images.get(o.assetId),a=assets.get(o.assetId),b=a.visibleBounds;let u=(px-r.x)/r.w;if(o.flipX)u=1-u;const sx=Math.min(a.width-1,Math.floor(b[0]+u*(b[2]-b[0]))),sy=Math.min(a.height-1,Math.floor(b[1]+(py-r.y)/r.h*(b[3]-b[1])));
  if(entry?.alpha?.[sy*a.width+sx]>10)return o;
 }
 return null;
}
canvas.addEventListener('dragover',e=>{if(ready&&!busy){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
canvas.addEventListener('drop',e=>{e.preventDefault();const id=e.dataTransfer.getData('application/x-pokestudy-asset');if(assets.get(id)?.transparent)addAsset(id,scenePoint(e.clientX,e.clientY,canvas.getBoundingClientRect()));});
canvas.addEventListener('pointerdown',e=>{
 if(!ready||busy||gesture||e.button!==0)return;finishRange();const rect=canvas.getBoundingClientRect(),point=scenePoint(e.clientX,e.clientY,rect),o=selected();let mode='move',object=null;
 if(o){const r=rectOf(o);if(Math.abs(e.clientX-(rect.left+(r.x+r.w)/WIDTH*rect.width))<16&&Math.abs(e.clientY-(rect.top+(r.y+r.h)/HEIGHT*rect.height))<16){object=o;mode='resize';}}
 object??=hit(point);selectedId=object?.id??null;updateUI();canvas.focus({preventScroll:true});
 if(!object)return;e.preventDefault();gesture={pointerId:e.pointerId,mode,start:point,object:clone(object),before:snapshot()};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(!gesture||e.pointerId!==gesture.pointerId)return;e.preventDefault();const point=scenePoint(e.clientX,e.clientY,canvas.getBoundingClientRect()),g=gesture;
 if(g.mode==='move')patchSelected({x:g.object.x+point.x-g.start.x,y:g.object.y+point.y-g.start.y});
 else{const s=objectSize(g.object,assets.get(g.object.assetId)),dx=(point.x-g.start.x)*WIDTH,dy=(point.y-g.start.y)*HEIGHT;const w=s.width*WIDTH,h=s.height*HEIGHT;patchSelected({width:g.object.width*(1+(dx*w+dy*h)/(w*w+h*h))});}
 paint();
});
function endGesture(e,cancel=false){if(!gesture||e.pointerId!==gesture.pointerId)return;const g=gesture;gesture=null;if(cancel){layout=g.before.layout;selectedId=g.before.selectedId;}else remember(g.before);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);updateUI();}
canvas.addEventListener('pointerup',e=>endGesture(e));canvas.addEventListener('pointercancel',e=>endGesture(e,true));canvas.addEventListener('lostpointercapture',e=>endGesture(e,true));
for(const id of ['size','opacity']){
 $(id).addEventListener('input',()=>{if(!selected()||busy)return;rangeBase??=snapshot();patchSelected(id==='size'?{width:Number($(id).value)/100}:{opacity:Number($(id).value)/100});$('sizeValue').value=`${(selected().width*100).toFixed(1)}%`;$('opacityValue').value=`${Math.round(selected().opacity*100)}%`;paint();queueSave();});
 $(id).addEventListener('change',()=>{finishRange();updateUI();});
}
$('category').onchange=palette;$('undo').onclick=undo;$('redo').onclick=redo;
$('delete').onclick=()=>change(()=>{layout.objects=layout.objects.filter(o=>o.id!==selectedId);selectedId=null;});
$('clear').onclick=()=>{change(()=>{layout.objects=[];selectedId=null;});say('배치를 비웠어요. 되돌리기로 복원할 수 있어요.');};
$('flip').onclick=()=>change(()=>{if(selected())selected().flipX=!selected().flipX;});
$('toggleHidden').onclick=()=>change(()=>{if(selected())selected().hidden=!selected().hidden;});
$('duplicate').onclick=()=>change(()=>{const o=selected();if(!o)return;if(layout.objects.length>=MAX_OBJECTS){say('배치할 수 있는 개수를 초과했어요.');return;}const copy=constrain({...o,id:crypto.randomUUID(),x:o.x+.03,y:o.y+.03,zIndex:Math.max(-1,...layout.objects.map(x=>x.zIndex))+1},assets.get(o.assetId));layout.objects.push(copy);selectedId=copy.id;});
function reorder(direction){change(()=>{const sorted=ordered(layout.objects),i=sorted.findIndex(o=>o.id===selectedId),j=i+direction;if(i<0||j<0||j>=sorted.length)return;[sorted[i],sorted[j]]=[sorted[j],sorted[i]];layout.objects=sorted.map((o,index)=>({...o,zIndex:index}));});}
$('forward').onclick=()=>reorder(1);$('backward').onclick=()=>reorder(-1);
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function saveJSON(){if(!ready||busy)return;finishRange();download(new Blob([JSON.stringify(layout,null,2)],{type:'application/json'}),'forest-layout.json');say('배치 JSON을 저장했어요. 이 파일을 불러오면 다시 편집할 수 있어요.');}
$('saveJson').onclick=saveJSON;
$('savePng').onclick=async()=>{if(!ready||busy)return;setBusy(true);try{finishRange();const out=document.createElement('canvas');out.width=WIDTH;out.height=HEIGHT;drawScene(out.getContext('2d'),false);const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('이미지를 저장하지 못했어요. 다시 시도해 주세요.');download(blob,'forest-layout.png');say('선택 테두리가 없는 완성 이미지를 PNG로 저장했어요.');}catch(e){say(e.message);}finally{setBusy(false);}};
$('loadJson').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file||busy)return;setBusy(true);
 try{if(file.size>1024*1024)throw Error('JSON 파일은 1MB 이하만 불러올 수 있어요.');const next=validateLayout(JSON.parse(await file.text()),assets);await Promise.all([...new Set(next.objects.map(o=>o.assetId))].map(loadAsset));setBusy(false);change(()=>{layout=next;selectedId=null;});say('배치 JSON을 불러왔어요. 에셋을 골라 계속 편집하세요.');}catch(e){say(e instanceof SyntaxError?'JSON 파일을 읽지 못했어요. 배치 JSON 파일을 선택해 주세요.':e.message);}finally{setBusy(false);}
};
document.addEventListener('keydown',e=>{
 if(!ready||busy||gesture||e.target.closest('input,select,textarea,[contenteditable=true]'))return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveJSON();return;}
 if(!selected())return;
 if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('delete').click();}
 const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
 if(move){e.preventDefault();change(()=>patchSelected({x:selected().x+move[0]*(e.shiftKey?10:1)/WIDTH,y:selected().y+move[1]*(e.shiftKey?10:1)/HEIGHT}));}
 if(e.key==='Escape'){selectedId=null;updateUI();}
});
new ResizeObserver(paint).observe(canvas);
async function start(){
 try{const response=await fetch(manifestURL);if(!response.ok)throw Error('에셋 목록을 불러오지 못했어요. 새로고침해 주세요.');const manifest=await response.json();assets=new Map(manifest.assets.map(a=>[a.id,a]));await loadAsset('background');let restored=false;
  try{const saved=localStorage.getItem(STORE);if(saved){const next=validateLayout(JSON.parse(saved),assets);await Promise.all([...new Set(next.objects.map(o=>o.assetId))].map(loadAsset));layout=next;restored=true;$('storageStatus').textContent='이 브라우저에 자동 저장됨 · 마지막 배치를 복원했습니다.';}}catch{$('storageStatus').textContent='이전 배치를 복원하지 못했어요. 보관한 JSON 파일이 있다면 불러와 주세요.';}
  ready=true;palette();for(const id of ['saveJson','savePng','loadJson'])$(id).disabled=false;updateUI();say(restored?'이 브라우저에 저장된 배치를 복원했어요.':'준비됐어요! 왼쪽 에셋을 눌러 배경에 놓아 보세요.');
 }catch(e){say(e.message||'편집기를 준비하지 못했어요. 새로고침해 주세요.');}
}
start();
