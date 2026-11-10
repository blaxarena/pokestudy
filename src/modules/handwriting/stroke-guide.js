import {loadWordStrokes} from './stroke-data.js';
const NS='http://www.w3.org/2000/svg';
let sequence=0;
function element(tag,attributes={}){
  const node=document.createElementNS(NS,tag);
  for(const [name,value] of Object.entries(attributes))node.setAttribute(name,String(value));
  return node;
}
function medianPath(points){return points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ');}
export function renderStrokeSvg(letters,{numbers=true,detail=false}={}){
  const svg=element('svg',{viewBox:`0 0 ${Math.max(1,letters.length)*1024} 1024`,role:'img','aria-label':letters.map(l=>l.character).join('')+' 획순 가이드'});
  const defs=element('defs');svg.append(defs);
  const records=[],prefix=`writing-stroke-${++sequence}`;
  letters.forEach((letter,letterPosition)=>{
    const x=letterPosition*1024,labels=[];
    if(!letter.data){
      const fallback=element('text',{x:x+512,y:750,'text-anchor':'middle','font-size':750,'font-family':'sans-serif',fill:'#d4d9e1'});fallback.textContent=letter.character;svg.append(fallback);return;
    }
    const group=element('g',{transform:`translate(${x} 900) scale(1 -1)`});svg.append(group);
    letter.data.strokes.forEach((path,index)=>{
      const id=`${prefix}-${letterPosition}-${index}`,points=letter.data.medians[index];
      group.append(element('path',{d:path,fill:'#d4d9e1'}));
      const clip=element('clipPath',{id,clipPathUnits:'userSpaceOnUse'});clip.append(element('path',{d:path}));defs.append(clip);
      const progress=element('path',{d:medianPath(points),fill:'none',stroke:'#3977bb','stroke-width':180,'stroke-linecap':'round','stroke-linejoin':'round','clip-path':`url(#${id})`,visibility:'hidden','data-stroke':index+1});
      group.append(progress);
      const dot=element('circle',{r:24,fill:'#e68143',visibility:'hidden'});group.append(dot);
      const start=points[0];
      if(detail){
        // A short arrow at the start explains writing direction without cluttering the whole word.
        const next=points[Math.min(2,points.length-1)],dx=next[0]-start[0],dy=next[1]-start[1],length=Math.hypot(dx,dy)||1;
        const ax=start[0]+dx/length*105,ay=start[1]+dy/length*105;
        group.append(element('path',{d:`M${start[0]} ${start[1]} L${ax} ${ay} M${ax-dx/length*34-dy/length*18} ${ay-dy/length*34+dx/length*18} L${ax} ${ay} L${ax-dx/length*34+dy/length*18} ${ay-dy/length*34-dx/length*18}`,fill:'none',stroke:'#6d91ba','stroke-width':9,'stroke-linecap':'round','stroke-linejoin':'round'}));
      }
      if(numbers){
        // Number labels are upright, outside the flipped stroke group.
        const startX=start[0],startY=900-start[1],baseX=startX-22,baseY=startY-38;
        const candidates=[[baseX,baseY]];
        for(const radius of [100,160,230])for(let angle=0;angle<8;angle++)candidates.push([baseX+Math.cos(angle*Math.PI/4)*radius,baseY+Math.sin(angle*Math.PI/4)*radius]);
        const locations=candidates.map(([cx,cy])=>[Math.max(48,Math.min(976,cx)),Math.max(48,Math.min(976,cy))]);
        const score=([cx,cy])=>labels.filter(([lx,ly])=>Math.hypot(lx-cx,ly-cy)<105).length*1e6+(cx-baseX)**2+(cy-baseY)**2;
        locations.sort((a,b)=>score(a)-score(b));const [labelX,labelY]=locations[0];labels.push([labelX,labelY]);
        const label=element('g',{'data-stroke-number':index+1,'aria-hidden':'true',class:'stroke-number'});
        label.append(element('line',{x1:x+startX,y1:startY,x2:x+labelX,y2:labelY,stroke:'#7899bb','stroke-width':6}));
        label.append(element('circle',{cx:x+startX,cy:startY,r:10,fill:'#6d91ba'}));
        label.append(element('circle',{cx:x+labelX,cy:labelY,r:45,fill:'#fff',stroke:'#6d91ba','stroke-width':7}));
        const text=element('text',{x:x+labelX,y:labelY+27,'text-anchor':'middle','font-size':78,'font-family':'sans-serif','font-weight':700,fill:'#386596'});text.textContent=index+1;label.append(text);svg.append(label);
      }
      records.push({letter,index,progress,dot});
    });
  });
  return {svg,records};
}
export function createStrokeGuide(){
  const $=id=>document.getElementById(id),host=$('writeStrokeGuide'),zoom=$('writeStrokeZoom'),tabs=$('writeStrokeLetters'),status=$('writeStrokeStatus');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let revision=0,letters=[],wordView=null,zoomView=null,selected=0,playing=false,animation=0,lastTime=null,elapsed=0,current=0,mode='word',shown=true;
  function visible(){
    return shown&&$('writeShowStrokeOrder').checked&&letters.some(l=>l.data);
  }
  function resetPaths(){
    for(const view of [wordView,zoomView])for(const record of view?.records||[]){record.progress.setAttribute('visibility','hidden');record.dot.setAttribute('visibility','hidden');}
  }
  function stop(){
    cancelAnimationFrame(animation);animation=0;playing=false;lastTime=null;elapsed=0;current=0;resetPaths();
    $('writePlayStrokes').textContent='획순 재생';$('writeStepStroke').disabled=!visible();
  }
  function updateVisibility(){
    const show=visible();host.classList.toggle('hidden',!show);$('writeGuideText').classList.toggle('hidden',!shown||show);
    $('writeStrokeDetails').classList.toggle('hidden',!show);$('writePlayStrokes').disabled=!show;$('writeStepStroke').disabled=!show;
    if(!show)stop();
  }
  function updateZoom(){
    const letter=letters[selected];if(!letter?.data){zoom.replaceChildren();zoomView=null;return;}
    zoomView=renderStrokeSvg([letter],{detail:true});zoom.replaceChildren(zoomView.svg);
    for(const button of tabs.children)button.setAttribute('aria-pressed',String(+button.dataset.letter===selected));
    $('writeStrokeZoomLabel').textContent=`${letter.character} · ${letter.data.strokes.length}획`;
  }
  function activeRecords(){return mode==='letter'?zoomView?.records||[]:wordView?.records||[];}
  function mirroredRecords(record){
    return [wordView,zoomView].flatMap(v=>v?.records.filter(r=>r.letter.index===record.letter.index&&r.index===record.index)||[]);
  }
  function paint(record,fraction){
    for(const r of mirroredRecords(record)){
      const length=r.progress.getTotalLength();r.progress.setAttribute('visibility','visible');
      r.progress.style.strokeDasharray=String(length);r.progress.style.strokeDashoffset=String(length*(1-fraction));
      const point=r.progress.getPointAtLength(length*fraction);r.dot.setAttribute('cx',point.x);r.dot.setAttribute('cy',point.y);r.dot.setAttribute('visibility',fraction<1?'visible':'hidden');
    }
    const notice=`${record.letter.character} · ${record.index+1}/${record.letter.data.strokes.length}획`;if(status.textContent!==notice)status.textContent=notice;
  }
  function frame(now){
    if(!playing||document.hidden){lastTime=null;return;}
    if(lastTime!==null)elapsed+=now-lastTime;lastTime=now;
    const records=activeRecords(),record=records[current];if(!record){playing=false;animation=0;$('writePlayStrokes').textContent='다시 재생';status.textContent='획순을 다 봤어요. 번호 순서대로 써 보세요.';return;}
    const duration=650,pause=180;paint(record,Math.min(1,elapsed/duration));
    if(elapsed>=duration+pause){current++;elapsed=0;lastTime=null;}
    animation=requestAnimationFrame(frame);
  }
  function play(){
    if(!visible())return;
    if(playing){stop();status.textContent='재생을 멈췄어요. 다시 보려면 획순 재생을 눌러요.';return;}
    if(reduced.matches){step();return;}
    stop();mode=$('writeStrokeDetails').open?'letter':'word';
    playing=true;$('writePlayStrokes').textContent='재생 멈추기';animation=requestAnimationFrame(frame);
  }
  function step(){
    if(!visible())return;
    if(playing)stop();
    mode=$('writeStrokeDetails').open?'letter':'word';const records=activeRecords();
    if(current>=records.length){resetPaths();current=0;}
    const record=records[current++];if(record)paint(record,1);
    $('writePlayStrokes').textContent='획순 재생';
  }
  $('writePlayStrokes').addEventListener('click',play);$('writeStepStroke').addEventListener('click',step);
  $('writeShowStrokeOrder').addEventListener('change',()=>{stop();updateVisibility();});
  $('writeStrokeDetails').addEventListener('toggle',()=>{stop();});
  document.addEventListener('visibilitychange',()=>{lastTime=null;if(document.hidden){cancelAnimationFrame(animation);animation=0;}else if(playing)animation=requestAnimationFrame(frame);});
  new MutationObserver(()=>{if($('writeModule').classList.contains('hidden'))stop();}).observe($('writeModule'),{attributes:true,attributeFilter:['class']});
  reduced.addEventListener('change',stop);
  return {
    async setName(name){
      const version=++revision;stop();letters=[];host.replaceChildren();zoom.replaceChildren();tabs.replaceChildren();wordView=zoomView=null;
      $('writeGuideText').textContent=name;updateVisibility();status.textContent='획순 가이드를 준비해요…';
      try{
        const loaded=await loadWordStrokes(name);if(version!==revision)return;
        letters=loaded;selected=Math.max(0,letters.findIndex(l=>l.data));
        wordView=renderStrokeSvg(letters);host.replaceChildren(wordView.svg);
        for(const letter of letters){
          if(!letter.data)continue;
          const button=document.createElement('button');button.type='button';button.className='btn outline';button.dataset.letter=letter.index;button.textContent=letter.character;button.setAttribute('aria-label',`${letter.character} 획순 크게 보기`);
          button.onclick=()=>{stop();selected=letter.index;updateZoom();};tabs.append(button);
        }
        updateZoom();updateVisibility();
        status.textContent=letters.every(l=>l.data)?'번호 순서대로 따라 써 보세요. 크게 보기에서 한 글자씩 볼 수 있어요.':'한글에 획순을 표시해요. 숫자·영문·기호는 글자 가이드로 보여요.';
      }catch{if(version!==revision)return;letters=[];updateVisibility();status.textContent='획순을 불러오지 못했어요. 연한 글자 가이드로 써 보세요.';}
    },
    setVisible(value){shown=value;updateVisibility();},
    async drawToCanvas(ctx,width,height){
      if(!visible()||!wordView)return false;
      // Save the same pale numbered guide, without transient animation highlights.
      const clean=renderStrokeSvg(letters).svg;clean.setAttribute('xmlns',NS);
      const svgRect=wordView.svg.getBoundingClientRect(),inkRect=$('writeInk').getBoundingClientRect();
      if(!svgRect.width||!inkRect.width)return false;
      const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clean));
      try{await image.decode();}catch{return false;}
      ctx.drawImage(image,(svgRect.left-inkRect.left)*width/inkRect.width,(svgRect.top-inkRect.top)*height/inkRect.height,svgRect.width*width/inkRect.width,svgRect.height*height/inkRect.height);return true;
    }
  };
}
