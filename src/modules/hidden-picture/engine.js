import {hitTest} from './hit-test.js';
import {loadLayoutScene,paintLayoutScene,refinePlacements} from './layout-scene.js';
import {placeLayoutPokemon} from './layout-placement.js';
import {placePokemon} from './placement.js';

(()=>{
  const $h=id=>document.getElementById(id);
  const API='https://pokeapi.co/api/v2/';
  const ART=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  const SPR=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  const themes={
    forest:{name:'숲속',types:['grass','bug','normal','poison','fairy'],bg:['#b9df9d','#e8f2c8'],decor:['🌳','🌲','🌿','🌼','🍄','🪵','🌻','🪨']},
    sea:{name:'바다',types:['water','ice'],bg:['#77c9e8','#d6f5f7'],decor:['🌊','🐚','🪸','🫧','🌴','🪨','🐠','🪷']},
    town:{name:'마을',types:['normal','electric','fairy','fighting'],bg:['#f6d7a8','#f8edcf'],decor:['🏠','🏡','🌷','🌳','🚏','🌼','🪴','☀️']},
    cave:{name:'동굴',types:['rock','ground','dark','steel'],bg:['#9b9a9c','#d8d0c5'],decor:['🪨','⛰️','💎','🕸️','🪵','🪨','✨','🪴']},
    lava:{name:'용암',types:['fire','rock','ground','dragon'],bg:['#f4a16d','#4a3b42'],decor:['🌋','🔥','🪨','🌑','💥','♨️','🧱','✨']},
    snow:{name:'설산',types:['ice','flying','psychic'],bg:['#c8e5f6','#f7fcff'],decor:['❄️','⛄','🌲','🏔️','🧊','🌨️','🌲','✨']},
    harbor:{name:'항구',types:['water','flying','electric','normal'],bg:['#8fd2df','#f5dfb8'],decor:['⚓','⛵','🌊','🛟','🐚','🏝️','🪝','☀️']}
  };
  const levels={easy:{total:12,targets:4},normal:{total:25,targets:8},hard:{total:45,targets:12}};
  let theme='forest',level='easy',scenePokemon=[],targetIds=new Set(),revealed=false,images=new Map(),candidateCache=null;
  let layoutScene=null;
  let sceneBackground=null,foundIds=new Set(),placedOrder=[],sceneReady=false;
  function paintScene(){
    const c=$h('hideScene'),ctx=c.getContext('2d'),w=c.width,h=c.height;
    if(layoutScene)paintLayoutScene(ctx,layoutScene,placedOrder,images,w,h);
    else{
      ctx.clearRect(0,0,w,h);ctx.fillStyle=themes[theme].bg[0];ctx.fillRect(0,0,w,h);drawDecor(ctx,theme,w,h);
      for(const p of placedOrder){const im=images.get(p.id);if(im)ctx.drawImage(im,p.x,p.y,p.w,p.h);}
    }
    placedOrder.forEach(p=>{
      if(p.target&&(foundIds.has(p.id)||revealed)){
        const cx=p.x+p.w/2,cy=p.y+p.h/2;
        ctx.save();ctx.strokeStyle=foundIds.has(p.id)?'#f2bd24':'#ed313b';ctx.lineWidth=Math.max(7,w/140);ctx.shadowColor='#fff';ctx.shadowBlur=5;
        ctx.beginPath();ctx.ellipse(cx,cy,p.w*.58,p.h*.58,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      }
    });
  }
  function updateFound(){
    const targets=scenePokemon.filter(p=>p.target);
    $h('hideFoundStatus').textContent=`찾은 수 ${foundIds.size} / ${targets.length}`;
    $h('hideTargets').querySelectorAll('[data-pokemon-id]').forEach(el=>{
      const yes=foundIds.has(Number(el.dataset.pokemonId));
      el.classList.toggle('found',yes);
      el.setAttribute('aria-label',el.dataset.name+(yes?' 찾았어요':' 아직 찾지 못했어요'));
    });
    if(foundIds.size===targets.length){
      $h('hideAnswerStatus').textContent='🎉 모두 찾았어요! 새로운 장면에도 도전해 보세요.';
      $h('hideSceneHint').textContent='축하해요! 목표 포켓몬을 전부 찾았어요.';
    }
  }
  $h('hideScene').addEventListener('pointerup',e=>{
    if(!sceneReady||revealed)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const p=hitTest(placedOrder,foundIds,e.clientX,e.clientY,rect,e.currentTarget.width,e.currentTarget.height);
    if(!p)return;
    foundIds.add(p.id);paintScene();updateFound();
    $h('hideSceneHint').textContent=`잘했어요! ${p.name} 찾았어요!`;
    try{if('speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(p.name);u.lang='ko-KR';u.rate=.85;speechSynthesis.speak(u);}}catch{}
  });
  const cacheKey='pokedexHiddenCandidatesV1';
  function shuffle(a){return a.map(x=>[Math.random(),x]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);}
  function setStatus(t){$h('hideLoadStatus').textContent=t;}
  document.querySelectorAll('#hideThemeOptions .theme-choice').forEach(b=>b.addEventListener('click',()=>{
    theme=b.dataset.theme;document.querySelectorAll('#hideThemeOptions .theme-choice').forEach(x=>x.classList.toggle('selected',x===b));
  }));
  document.querySelectorAll('#hideDifficultyOptions .difficulty-choice').forEach(b=>b.addEventListener('click',()=>{
    level=b.dataset.level;document.querySelectorAll('#hideDifficultyOptions .difficulty-choice').forEach(x=>x.classList.toggle('selected',x===b));
  }));
  async function json(url){const r=await fetch(url);if(!r.ok)throw new Error('포켓몬 데이터를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');return r.json();}
  async function getCandidates(){
    if(candidateCache)return candidateCache;
    try{const saved=localStorage.getItem(cacheKey);if(saved){candidateCache=JSON.parse(saved);return candidateCache;}}catch(e){}
    setStatus('1~9세대 포켓몬 목록을 확인하고 있어요…');
    const gens=await Promise.all(Array.from({length:9},(_,i)=>json(`${API}generation/${i+1}/`)));
    const ids=[...new Set(gens.flatMap(g=>g.pokemon_species.map(x=>Number((x.url.match(/pokemon-species\/(\d+)/)||[])[1])).filter(id=>id>0&&id<=1025)))];
    const chosen=shuffle(ids).slice(0,150);
    const rows=[];
    for(let i=0;i<chosen.length;i+=15){
      setStatus(`포켓몬 정보를 모으는 중이에요… (${Math.min(i+15,chosen.length)}/${chosen.length})`);
      const batch=await Promise.all(chosen.slice(i,i+15).map(async id=>{try{const p=await json(`${API}pokemon/${id}/`);return {id,name:null,types:p.types.map(t=>t.type.name),image:p.sprites.other?.['official-artwork']?.front_default||p.sprites.front_default||ART(id),fallback:SPR(id)};}catch(e){return null;}}));
      rows.push(...batch.filter(Boolean));
    }
    // Load Korean names for the candidates; species IDs correspond to base Pokémon IDs for this pool.
    for(let i=0;i<rows.length;i+=15){
      const batch=await Promise.all(rows.slice(i,i+15).map(async p=>{try{const sp=await json(`${API}pokemon-species/${p.id}/`);p.name=sp.names.find(n=>n.language.name==='ko')?.name||sp.name;return p;}catch(e){p.name=`포켓몬 ${p.id}`;return p;}}));
      batch.forEach(p=>{});
    }
    candidateCache=rows.filter(p=>p.name);
    if(candidateCache.length<45){candidateCache=null;throw new Error('포켓몬 정보를 충분히 받지 못했어요. 다시 시도해 주세요.');}
    try{localStorage.setItem(cacheKey,JSON.stringify(candidateCache));}catch(e){}
    return candidateCache;
  }
  function drawDecor(ctx,t,w,h){
    const d=themes[t].decor;
    for(let i=0;i<26;i++){
      const x=(i*173+47)%w,y=70+((i*97+33)%(h-110));
      ctx.globalAlpha=.28+(i%3)*.12;ctx.font=`${28+(i%3)*9}px system-ui`;ctx.textAlign='center';ctx.fillText(d[i%d.length],x,y);
    }
    ctx.globalAlpha=1;
    // Soft foreground landscape layers.
    ctx.fillStyle=t==='sea'||t==='harbor'?'#4bafc7':t==='snow'?'#eaf5fb':t==='lava'?'#6d4140':t==='cave'?'#625b60':t==='town'?'#9dc77e':'#79ad69';
    ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(w*.18,h*.93,w*.34,h*.19,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(w*.78,h*.96,w*.42,h*.22,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  }
  const pokemonImageCache=new Map();
  function loadImage(url){
    if(!pokemonImageCache.has(url))pokemonImageCache.set(url,new Promise(resolve=>{
      const im=new Image();im.crossOrigin='anonymous';const timer=setTimeout(()=>{im.onload=im.onerror=null;resolve(null);},15000);
      im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);resolve(null);};im.src=url;
    }).then(image=>{if(!image)pokemonImageCache.delete(url);return image;}));
    return pokemonImageCache.get(url);
  }
  async function makeScene(){
    sceneReady=false;$h('hideAnswerBtn').disabled=true;
    try{
      const conf=levels[level];
      const [pool,nextScene]=await Promise.all([getCandidates(),['forest','sea'].includes(theme)?loadLayoutScene(new URL(`../../../public/assets/${theme}/scene-01/scene-layout-v1.json`,import.meta.url).href):null]);
      setStatus('배치한 장면에 포켓몬을 숨기고 있어요…');
      const pref=themes[theme].types,ranked=shuffle(pool.filter(p=>p.types.some(t=>pref.includes(t)))),fallback=shuffle(pool.filter(p=>!ranked.some(r=>r.id===p.id)));
      const chosen=[...ranked,...fallback].slice(0,conf.total);
      if(chosen.length<conf.total)throw new Error('장면을 만들 포켓몬이 부족해요. 다시 시도해 주세요.');
      const nextPokemon=shuffle(chosen.map((p,i)=>({...p,target:i<conf.targets})));const loaded=await Promise.all(nextPokemon.map(async p=>await loadImage(p.image)||await loadImage(p.fallback)));
      if(loaded.some(im=>!im))throw new Error('포켓몬 이미지를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
      const nextImages=new Map(nextPokemon.map((p,i)=>[p.id,loaded[i]])),canvas=$h('hideScene');const w=nextScene?.logicalSize.width??3840,h=nextScene?.logicalSize.height??2160;
      const positions=nextScene?refinePlacements(nextScene,placeLayoutPokemon(nextPokemon,level,nextScene.variants,w,h),nextImages,level,w,h):placePokemon(nextPokemon,level,null,w,h);
      if(nextScene){const hidden=shuffle(positions.filter(p=>p.occlusionRatio>=.025)),open=shuffle(positions.filter(p=>p.occlusionRatio<.025)),targets=new Set([...hidden,...open].slice(0,conf.targets).map(p=>p.id));for(const p of positions)p.target=targets.has(p.id);}
      canvas.width=w;canvas.height=h;layoutScene=nextScene;sceneBackground=nextScene?.backgroundImage??null;images=nextImages;scenePokemon=positions;placedOrder=positions;
      targetIds=new Set(positions.filter(p=>p.target).map(p=>p.id));foundIds.clear();revealed=false;paintScene();sceneReady=true;renderTargets();updateFound();
      $h('hideAnswerBtn').textContent='🔍 정답 확인';$h('hideAnswerStatus').textContent='버튼을 누르면 남은 목표의 위치를 알려줘요.';
      $h('hideSceneHint').textContent=nextScene?(theme==='sea'?'고래왕 섬에서 포켓몬을 찾아보세요. 바위와 해초 뒤도 살펴보세요.':'직접 만든 숲속에서 포켓몬을 찾아보세요. 나무와 수풀 뒤도 살펴보세요.'):'포켓몬을 하나씩 찾아보세요. 정답 확인 전에는 위치가 표시되지 않아요.';
    }catch(error){sceneReady=placedOrder.length>0;throw error;}
    finally{$h('hideAnswerBtn').disabled=revealed||!sceneReady;}
  }
  function renderTargets(){
    const targets=scenePokemon.filter(p=>p.target);
    $h('hideTargets').innerHTML=targets.map(p=>`<div class="hide-target" data-pokemon-id="${p.id}" data-name="${p.name}"><img src="${p.image}" alt="${p.name}" onerror="this.src='${p.fallback}'"><strong>${p.name}</strong></div>`).join('');
  }
  function revealAnswers(){
    if(revealed)return;revealed=true;paintScene();
    $h('hideAnswerBtn').disabled=true;$h('hideAnswerBtn').textContent='정답 확인 완료';
    $h('hideAnswerStatus').textContent='빨간 동그라미는 아직 찾지 못한 포켓몬이에요.';
    $h('hideSceneHint').textContent='그림에 정답 위치를 표시했어요.';
  }
  async function startGame(){
    const btn=$h('hideStartBtn');btn.disabled=true;$h('hideAgainBtn').disabled=true;
    try{
      setStatus('숨은그림찾기 장면을 준비하고 있어요…');
      await makeScene();
      $h('hideSetup').classList.add('hidden');$h('hideGame').classList.remove('hidden');
      $h('hideGameTitle').textContent=`${theme==='forest'?'나의 숲속':theme==='sea'?'고래왕 섬':themes[theme].name} · ${level==='easy'?'쉬움':level==='normal'?'보통':'어려움'}`;
    }catch(e){setStatus(e.message||'장면을 만드는 중 문제가 생겼어요.');}
    finally{btn.disabled=false;$h('hideAgainBtn').disabled=false;}
  }
  $h('hideStartBtn').addEventListener('click',startGame);
  $h('hideAnswerBtn').addEventListener('click',revealAnswers);
  $h('hideBackBtn').addEventListener('click',()=>{$h('hideGame').classList.add('hidden');$h('hideSetup').classList.remove('hidden');});
  const requestedTheme=new URLSearchParams(location.search).get('play');
  if(['forest','sea'].includes(requestedTheme)){document.querySelector(`#hideThemeOptions [data-theme=${requestedTheme}]`)?.click();document.querySelector('nav [data-module=hideModule]')?.click();}
  $h('hideAgainBtn').addEventListener('click',async()=>{
    const b=$h('hideAgainBtn');b.disabled=true;
    try{await makeScene();}catch(e){$h('hideAnswerStatus').textContent=e.message;}
    finally{b.disabled=false;}
  });
})();
