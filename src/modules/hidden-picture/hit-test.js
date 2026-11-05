export function hitTest(items,found,clientX,clientY,rect,width,height){
 const x=(clientX-rect.left)*width/rect.width,y=(clientY-rect.top)*height/rect.height;
 const candidates=items.filter(p=>p.target&&!found.has(p.id)&&Math.abs(x-p.x-p.w/2)<=Math.max(p.w/2,22*width/rect.width)&&Math.abs(y-p.y-p.h/2)<=Math.max(p.h/2,22*height/rect.height));
 return candidates.sort((a,b)=>Math.hypot(x-a.x-a.w/2,y-a.y-a.h/2)-Math.hypot(x-b.x-b.w/2,y-b.y-b.h/2))[0];
}
