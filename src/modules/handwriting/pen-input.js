export const INPUT_MODES=['auto','pen','all'];
export function acceptsDrawingPointer(mode,penDetected,pointerType){
  return pointerType==='pen'||(mode!=='pen'&&!(mode==='auto'&&penDetected));
}
// Browsers cannot query whether an Apple Pencil is paired. Learn from actual pen events.
export function createPenInput(){
  const key='pokestudy-drawing-input-mode';let mode='auto',penDetected=false;
  try{const saved=localStorage.getItem(key);if(INPUT_MODES.includes(saved))mode=saved;}catch{}
  const listeners=new Set(),selectors=[...document.querySelectorAll('[data-drawing-input]')],statuses=[...document.querySelectorAll('[data-drawing-input-status]')];
  function update(){
    for(const select of selectors)select.value=mode;
    const text=mode==='pen'?'펜만 쓰기: 손가락·손바닥·마우스는 그림에 입력되지 않아요.':mode==='all'?'펜·손가락·마우스로 그릴 수 있어요.':penDetected?'펜을 감지했어요. 이제 펜만 그림에 입력돼요.':'자동: 펜으로 한 번 쓰면 손가락·손바닥 입력을 막아요.';
    for(const status of statuses)if(status.textContent!==text)status.textContent=text;
    for(const listener of listeners)listener();
  }
  for(const select of selectors)select.addEventListener('change',()=>{
    mode=INPUT_MODES.includes(select.value)?select.value:'auto';
    try{localStorage.setItem(key,mode);}catch{}
    update();
  });
  document.addEventListener('pointerdown',event=>{
    if(event.pointerType==='pen'&&!penDetected){penDetected=true;update();}
  },true);
  update();
  return {
    accepts:event=>acceptsDrawingPointer(mode,penDetected,event.pointerType),
    onChange:listener=>listeners.add(listener)
  };
}
