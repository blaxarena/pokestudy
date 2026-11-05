// Read actual character alpha; transparent sprite margins do not count as visible pixels.
export function spriteSamples({data,width,height}){
 const points=[];let minY=height,maxY=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=data[(y*width+x)*4+3];if(alpha>32){points.push({x:(x+.5)/width,y:(y+.5)/height,weight:alpha/255,row:y});minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
 if(!points.length)throw new Error('포켓몬 그림이 비어 있어요. 다시 시도해 주세요.');
 const cutoff=minY+(maxY-minY+1)*.38;
 return points.map(p=>({...p,head:p.row<cutoff}));
}
export function measureOcclusion(points,rect,mask,maskWidth,maskHeight,sceneWidth,sceneHeight){
 let weight=0,covered=0,headWeight=0,headCovered=0;
 for(const p of points){const x=Math.max(0,Math.min(maskWidth-1,Math.floor((rect.x+p.x*rect.w)/sceneWidth*maskWidth))),y=Math.max(0,Math.min(maskHeight-1,Math.floor((rect.y+p.y*rect.h)/sceneHeight*maskHeight)));const alpha=mask[y*maskWidth+x]/255;weight+=p.weight;covered+=alpha*p.weight;if(p.head){headWeight+=p.weight;headCovered+=alpha*p.weight;}}
 return {body:covered/weight,head:headWeight?headCovered/headWeight:0};
}
