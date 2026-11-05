"""Package individually generated PNG assets after inspection (requires Pillow).
Input is a JSON array of id/file/label/transparent/path records. No image edits.
"""
from pathlib import Path
from collections import Counter
from PIL import Image
import argparse,json,re,shutil,hashlib,zipfile
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('scene_id');p.add_argument('records',type=Path);p.add_argument('--summary',required=True);p.add_argument('--zip',action='store_true');args=p.parse_args()
if not re.fullmatch('[a-z0-9]+-[0-9]{2}',args.scene_id):p.error('Invalid scene id')
output=root/'asset-packages'/args.scene_id;output.mkdir(parents=True,exist_ok=True)
records=json.loads(args.records.read_text());assets=[];issues=[]
assert len({r['id'] for r in records})==len(records)
for record in records:
 file=Path(record['file'])
 if file.is_absolute() or '..' in file.parts:raise ValueError('Invalid asset path')
 target=output/file;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(record['path'],target)
 with Image.open(target) as image:
  if image.size!=(1672,941):issues.append([record['id'],'size',image.size])
  a={k:record[k] for k in ('id','file','label','transparent')};a.update(category=file.parts[0],width=image.width,height=image.height,bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),reviewRequired=False,provenance='Individually generated; not cut from a composite asset sheet.')
  if record['transparent']:
   if 'A' not in image.getbands():issues.append([record['id'],'missing alpha']);assets.append(a);continue
   alpha=image.getchannel('A');hist=alpha.histogram();a['alphaRange']=list(alpha.getextrema());a['transparentPixelRatio']=round(hist[0]/(image.width*image.height),5)
   a['visibleBounds']=list(alpha.point(lambda v:255 if v>10 else 0).getbbox() or (0,0,0,0));a['cornerAlpha']=[alpha.getpixel(pt) for pt in [(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]]
   a['borderMaxAlpha']=max(alpha.crop((0,0,image.width,1)).getextrema()[1],alpha.crop((0,image.height-1,image.width,image.height)).getextrema()[1],alpha.crop((0,0,1,image.height)).getextrema()[1],alpha.crop((image.width-1,0,image.width,image.height)).getextrema()[1])
   if a['alphaRange']!=[0,255] or a['transparentPixelRatio']<.1:issues.append([record['id'],'alpha coverage'])
   if max(a['cornerAlpha'])>1:issues.append([record['id'],'corners',a['cornerAlpha']])
   if a['borderMaxAlpha']>10:issues.append([record['id'],'border',a['borderMaxAlpha']])
   b=a['visibleBounds'];a['anchor']={'x':round((b[0]+b[2])/2/image.width,6),'y':round(b[3]/image.height,6)}
  elif 'A' in image.getbands() and image.getchannel('A').getextrema()!=(255,255):issues.append([record['id'],'background opacity'])
  assets.append(a)
manifest={'id':args.scene_id+'-independent-assets','sceneId':args.scene_id,'canvas':{'width':1672,'height':941},'summary':args.summary,'assets':assets}
(output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(output/'SHA256SUMS').write_text(''.join(a['sha256']+'  '+a['file']+'\n' for a in assets))
print('Categories:',dict(Counter(a['category'] for a in assets)));print('PNG bytes:',sum(a['bytes'] for a in assets));print('Issues:',issues)
Path('/tmp/'+args.scene_id+'-issues.json').write_text(json.dumps(issues))
if issues:raise SystemExit(1)
if args.zip:
 archive=output.parent/(args.scene_id+'.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for path in sorted(output.rglob('*')):
   if path.is_file():z.write(path,args.scene_id+'/'+str(path.relative_to(output)))
 with zipfile.ZipFile(archive) as z:assert z.testzip() is None
 print('ZIP bytes:',archive.stat().st_size)
