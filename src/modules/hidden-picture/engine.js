import {hitTest} from './hit-test.js';
import {loadScene, drawObjects} from './scene-loader.js';
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
  let forestScene=null;
  let sceneBackground=null,foundIds=new Set(),placedOrder=[],sceneReady=false;
  function paintScene(){
    const c=$h('hideScene'),ctx=c.getContext('2d'),w=c.width,h=c.height;
    ctx.clearRect(0,0,w,h);
    if(sceneBackground)ctx.drawImage(sceneBackground,0,0,w,h);
    else {ctx.fillStyle='#b9df9d';ctx.fillRect(0,0,w,h);drawDecor(ctx,theme,w,h);}
    if(theme==='forest'&&forestScene)drawObjects(ctx,forestScene,w,h,0,49);
    placedOrder.forEach(p=>{
      const im=images.get(p.id);
      if(im){ctx.save();ctx.drawImage(im,p.x,p.y,p.w,p.h);ctx.restore();}

    });
    if(theme==='forest'&&forestScene)drawObjects(ctx,forestScene,w,h,50,999);
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
  function loadImage(url){return new Promise(resolve=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=url;});}
  async function makeScene(){
    sceneReady=false;
    const conf=levels[level],pool=await getCandidates(),pref=themes[theme].types;
    const ranked=shuffle(pool.filter(p=>p.types.some(t=>pref.includes(t))));
    const fallback=shuffle(pool.filter(p=>!ranked.some(r=>r.id===p.id)));
    let chosen=ranked.slice(0,conf.total);
    if(chosen.length<conf.total)chosen=chosen.concat(fallback.slice(0,conf.total-chosen.length));
    if(chosen.length<conf.total)throw new Error('장면을 만들 포켓몬이 부족해요. 다시 시도해 주세요.');
    scenePokemon=chosen.map((p,i)=>({...p,target:i<conf.targets,x:0,y:0,w:0,h:0}));
    const shuffled=shuffle(scenePokemon);
    targetIds=new Set(shuffled.filter(p=>p.target).map(p=>p.id));
    shuffled.forEach(p=>{p.target=targetIds.has(p.id);});

    sceneReady=false;foundIds.clear();images.clear();placedOrder=[];
    const canvas=$h('hideScene'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    forestScene=theme==='forest'?await loadScene('/public/assets/forest/scene-01/scene.json'):null;
    sceneBackground=forestScene?.backgroundImage??null;
    if(theme==='forest'&&!sceneBackground)throw new Error('숲속 배경을 불러오지 못했어요. 다시 시도해 주세요.');
    // Place Pokémon in varied natural-looking areas rather than a rigid grid.
    const zones=[
      [.08,.25],[.22,.24],[.39,.22],[.58,.23],[.79,.23],[.92,.34],
      [.12,.53],[.29,.48],[.47,.48],[.68,.47],[.86,.54],
      [.08,.78],[.25,.73],[.43,.79],[.61,.72],[.81,.78],[.94,.76],
      [.18,.38],[.36,.34],[.55,.36],[.74,.36],[.90,.43],
      [.08,.64],[.32,.62],[.51,.62],[.72,.62],[.89,.64],
      [.18,.88],[.39,.89],[.59,.88],[.77,.89],[.95,.88],
      [.28,.17],[.49,.17],[.69,.18],[.84,.17],[.04,.43],
      [.42,.43],[.63,.43],[.97,.49],[.15,.68],[.55,.54],
      [.76,.55],[.34,.55],[.68,.84],[.48,.91]
    ];
    const shuffledZones=shuffle(zones).slice(0,shuffled.length);
    const loaded=await Promise.all(shuffled.map(async p=>await loadImage(p.image)||await loadImage(p.fallback)));
    if(loaded.some(im=>!im))throw new Error('포켓몬 이미지를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    const placements=placePokemon(shuffled,level,forestScene?.slots,w,h);
    placements.forEach((p,i)=>{Object.assign(shuffled[i],p);images.set(p.id,loaded[i]);});
    revealed=false;placedOrder=shuffled;paintScene();sceneReady=true;
    renderTargets();updateFound();

    $h('hideAnswerBtn').disabled=false;$h('hideAnswerBtn').textContent='🔍 정답 확인';
    $h('hideAnswerStatus').textContent='버튼을 누르면 숨겨진 위치를 모두 알려줘요.';
    $h('hideSceneHint').textContent='포켓몬을 하나씩 찾아보세요. 정답 확인 전에는 위치가 표시되지 않아요.';
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
      $h('hideGameTitle').textContent=`${themes[theme].name} · ${level==='easy'?'쉬움':level==='normal'?'보통':'어려움'}`;
    }catch(e){setStatus(e.message||'장면을 만드는 중 문제가 생겼어요.');}
    finally{btn.disabled=false;$h('hideAgainBtn').disabled=false;}
  }
  $h('hideStartBtn').addEventListener('click',startGame);
  $h('hideAnswerBtn').addEventListener('click',revealAnswers);
  $h('hideBackBtn').addEventListener('click',()=>{$h('hideGame').classList.add('hidden');$h('hideSetup').classList.remove('hidden');});
  $h('hideAgainBtn').addEventListener('click',async()=>{
    const b=$h('hideAgainBtn');b.disabled=true;
    try{await makeScene();}catch(e){$h('hideAnswerStatus').textContent=e.message;}
    finally{b.disabled=false;}
  });
})();
