"""Analyze alpha masks to compile hide slots. Does not modify artwork.
Development utility only: requires Pillow and NumPy; output JSON is committed.
"""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'public/assets/forest/scene-01'
source=DIR/'forest-layout.json';manifest_path=ROOT/'asset-packages/forest-01/manifest.json'
layout=json.loads(source.read_text());manifest=json.loads(manifest_path.read_text());assets={a['id']:a for a in manifest['assets']}
W,H=418,235
objects=sorted(layout['objects'],key=lambda o:o['zIndex']);alphas=[];rects=[]
for o in objects:
 a=assets[o['assetId']];b=a['visibleBounds'];width=o['width'];height=width*1672/941*(b[3]-b[1])/(b[2]-b[0]);rects.append((o['x'],o['y'],width,height))
 layer=np.zeros((H,W),np.float32)
 if not o['hidden']:
  with Image.open(ROOT/'asset-packages/forest-01'/a['file']) as im:
   alpha=im.getchannel('A').crop(tuple(b))
   if o['flipX']:alpha=alpha.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   ww=max(1,round(width*W));hh=max(1,round(height*H));sample=np.asarray(alpha.resize((ww,hh),Image.Resampling.BILINEAR),np.float32)/255*o['opacity']
   x=round(o['x']*W);y=round(o['y']*H);right=min(W,x+ww);bottom=min(H,y+hh)
   layer[y:bottom,x:right]=sample[:bottom-y,:right-x]
 alphas.append(layer)
masks=[None]*(len(objects)+1);masks[-1]=np.zeros((H,W),np.float32)
for i in range(len(objects)-1,-1,-1):masks[i]=alphas[i]+masks[i+1]*(1-alphas[i])
integrals=np.array([np.pad(m.cumsum(0,dtype=np.float64).cumsum(1),((1,0),(1,0))) for m in masks])
def coverage(xs,ys,width,height,head=False):
 x0=np.clip(np.floor((xs-width/2)*W).astype(int),0,W-1);x1=np.clip(np.ceil((xs+width/2)*W).astype(int),1,W)
 y0=np.clip(np.floor((ys-height/2)*H).astype(int),0,H-1);y1=np.clip(np.ceil((ys-height/2+height*(.45 if head else 1))*H).astype(int),1,H)
 return (integrals[:,y1,x1]-integrals[:,y0,x1]-integrals[:,y1,x0]+integrals[:,y0,x0])/((x1-x0)*(y1-y0))
rng=np.random.default_rng(20261105);variants={}
for level,count,width,limit,head_limit,targets in [('easy',12,.081,.18,.08,4),('normal',25,.072,.27,.12,8),('hard',45,.056,.35,.16,12)]:
 height=width*1672/941
 # Dense candidate pool allows irregular placement without retaining a visible grid.
 xs=rng.uniform(width/2+.015,1-width/2-.015,9000);ys=rng.uniform(max(.16,height/2+.015),1-height/2-.015,9000)
 cover=coverage(xs,ys,width,height);head=coverage(xs,ys,width,height,True)
 indices=((cover<=limit)&(head<=head_limit)).argmax(axis=0);amount=cover[indices,np.arange(len(xs))];head_amount=head[indices,np.arange(len(xs))]
 rows=[]
 for variant in range(24):
  selected=None
  for attempt in range(80):
   # Give partial hiding a gentle preference; retain open slots for variety.
   order=np.argsort(rng.random(len(xs))-amount*.65);chosen=[]
   for index in order:
    x=float(xs[index]);y=float(ys[index])
    if any(abs(x-float(xs[j]))<width+.003 and abs(y-float(ys[j]))<height+.003 for j in chosen):continue
    chosen.append(int(index))
    if len(chosen)==count:break
   if len(chosen)==count and sum(amount[j]>=.025 for j in chosen)>=targets:selected=chosen;break
  if selected is None:raise RuntimeError(f'Could not pack valid {level} layout')
  slots=[]
  for slot,index in enumerate(selected):
   depth=int(indices[index]);z=objects[depth]['zIndex']-.5 if depth<len(objects) else objects[-1]['zIndex']+.5
   x=float(xs[index]);y=float(ys[index]);foreground=[]
   for o,(ox,oy,ow,oh) in zip(objects,rects):
    if not o['hidden'] and o['zIndex']>z and ox<x+width/2 and ox+ow>x-width/2 and oy<y+height/2 and oy+oh>y-height/2:foreground.append(o['id'])
   slots.append({'slotId':f'{level}-{variant}-{slot}','x':round(x,8),'y':round(y,8),'width':width,'zIndex':z,'occlusionRatio':round(float(amount[index]),6),'headOcclusionRatio':round(float(head_amount[index]),6),'maxOcclusionRatio':{'easy':.22,'normal':.32,'hard':.42}[level],'foregroundObjectIds':foreground})
  rows.append(slots)
 variants[level]=rows
 print(level,':',len(rows),'variants,',count,'Pokemon, partial hiding minimum',min(sum(s['occlusionRatio']>=.025 for s in row) for row in rows))
config={'id':'forest-01-user-layout','version':2,'logicalSize':layout['canvas'],'layout':'forest-layout.json','assetManifest':'../../../../asset-packages/forest-01/manifest.json','layoutSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'manifestSha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),'variants':variants}
(DIR/'scene-layout-v1.json').write_text(json.dumps(config,ensure_ascii=False,separators=(',',':'))+'\n')
