// The guide is a separate DOM element; inspect only the child's ink canvas.
// White eraser strokes must not turn an otherwise blank page into completed work.
export function hasWritingInk(canvas){
  const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]>16&&Math.min(data[i],data[i+1],data[i+2])<250)return true;
  }
  return false;
}
