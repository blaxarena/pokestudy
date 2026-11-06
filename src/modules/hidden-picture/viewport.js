// In-page focus mode also works on browsers without the Fullscreen API.
const game=document.getElementById('hideGame'),module=document.getElementById('hideModule');
const button=document.getElementById('hideFocusBtn');
let focused=false,previousScroll=0;
function fitScene(){
 if(!focused)return;
 const viewport=window.visualViewport;
 const height=viewport?.height??innerHeight;
 const header=game.querySelector('.quiz-head').getBoundingClientRect().height;
 const stacked=matchMedia('(max-width:1099px)').matches;
 const sidebar=stacked?game.querySelector('.hide-sidebar').getBoundingClientRect().height:0;
 // Leave room for the scene title, hint, panel padding and browser safe areas.
 const available=Math.max(120,height-header-sidebar-110);
 game.style.setProperty('--scene-fit-width',`${available*16/9}px`);
}
function setFocus(value,restore=true){
 if(value===focused)return;
 if(value)previousScroll=scrollY;
 focused=value;document.body.classList.toggle('game-focus',value);
 button.setAttribute('aria-pressed',String(value));button.textContent=value?'↙ 원래 화면으로':'⛶ 게임 크게 보기';
 if(value){game.scrollTop=0;requestAnimationFrame(fitScene);}
 else{game.style.removeProperty('--scene-fit-width');if(restore){window.scrollTo(0,previousScroll);button.focus({preventScroll:true});}}
}
button.addEventListener('click',()=>setFocus(!focused));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&focused){event.preventDefault();setFocus(false);}});
const observer=new MutationObserver(()=>{if(game.classList.contains('hidden')||module.classList.contains('hidden'))setFocus(false,false);});
observer.observe(game,{attributes:true,attributeFilter:['class']});observer.observe(module,{attributes:true,attributeFilter:['class']});
new ResizeObserver(()=>requestAnimationFrame(fitScene)).observe(game.querySelector('.hide-sidebar'));
window.addEventListener('resize',fitScene);window.visualViewport?.addEventListener('resize',fitScene);
