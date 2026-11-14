"""Independent check: nearest assignment, sums, frozen fit, errors and raw hashes."""
from pathlib import Path
import csv,json,math,hashlib,zipfile,bisect,datetime
root=Path(__file__).resolve().parent.parent/'study-overpasses'
if not root.exists():root=Path(__file__).resolve().parent
read=lambda name:list(csv.DictReader((root/name).open(encoding='utf-8')))
report=json.loads((root/'report.json').read_text(encoding='utf-8'));frozen=json.loads((root/'frozen-model.json').read_text(encoding='utf-8'))
assert hashlib.sha256((root/'frozen-model.json').read_bytes()).hexdigest()==report['frozenModelSha256']
assert hashlib.sha256((root/'protocol.json').read_bytes()).hexdigest()==report['protocolSha256']
def ts(r):return datetime.datetime.fromisoformat(r['date']+'T'+r['acqTimeUtc']+':00+00:00').timestamp()
def dist(a,v):
 rad=math.pi/180;aa=math.sin((float(v['lat'])-float(a['lat']))*rad/2)**2+math.cos(float(a['lat'])*rad)*math.cos(float(v['lat'])*rad)*math.sin((float(v['lng'])-float(a['lng']))*rad/2)**2
 return 6371.0088*2*math.asin(min(1,math.sqrt(aa)))
def key(a):return '|'.join(a[k] for k in ['satellite','date','acqTimeUtc','lat','lng'])
assignment_checks=0
for year,split in [(2024,'train'),(2025,'test')]:
 records=read(f'eligible-{year}.csv');byid={r['id']:r for r in records};assert len(byid)==len(records)
 aqua=sorted([r for r in records if r['sensor']=='MODIS'],key=lambda r:(ts(r),key(r)));times=[ts(r) for r in aqua]
 viirs=[r for r in records if r['sensor']=='VIIRS'];actual=read(f'{split}-assignments.csv');lookup={r['viirsId']:r for r in actual};assert len(lookup)==len(actual)
 groups={r['aquaId']:r for r in read(f'{split}-groups.csv')};sums={};counts={}
 for v in viirs:
  vt=ts(v);candidates=[]
  for i in range(bisect.bisect_left(times,vt-3600),bisect.bisect_right(times,vt+3600)):
   a=aqua[i]
   if a['dayNight']!=v['dayNight']:continue
   km=dist(a,v)
   if km<=2:candidates.append((km,abs(times[i]-vt)/60,key(a),a['id']))
  if not candidates:assert v['id'] not in lookup;continue
  expected=min(candidates);got=lookup[v['id']];assert got['aquaId']==expected[3]
  assert math.isclose(float(got['km']),expected[0],abs_tol=1e-8);assert math.isclose(float(got['minutes']),expected[1],abs_tol=1e-8)
  assert byid[got['aquaId']]['satellite'].lower() in ['aqua','a'];assert v['satellite'].lower() in ['n20','noaa20','noaa-20']
  sums[got['aquaId']]=sums.get(got['aquaId'],0)+float(v['frpMw']);counts[got['aquaId']]=counts.get(got['aquaId'],0)+1;assignment_checks+=1
 assert set(sums)==set(groups)
 for aid,g in groups.items():assert math.isclose(sums[aid],float(g['viirsFrp']),rel_tol=1e-12);assert counts[aid]==int(g['viirsCount']);assert math.isclose(float(g['aquaFrp']),float(byid[aid]['frpMw']),rel_tol=1e-12)
train=read('train-groups.csv');test=read('test-groups.csv');assert all(g['date'].startswith('2024-') for g in train);assert all(g['date'].startswith('2025-') for g in test)
scale=sum(float(g['aquaFrp'])*float(g['viirsFrp']) for g in train)/sum(float(g['aquaFrp'])**2 for g in train)
mean=sum(float(g['viirsFrp']) for g in train)/len(train);assert math.isclose(scale,frozen['fits'][0]['model']['scale'],rel_tol=1e-12)
for label,predict in [('calibrated',lambda g:float(g['aquaFrp'])*scale),('identity',lambda g:float(g['aquaFrp'])),('trainingMean',lambda g:mean)]:
 errors=[predict(g)-float(g['viirsFrp']) for g in test];metrics={'mae':sum(map(abs,errors))/len(errors),'rmse':math.sqrt(sum(e*e for e in errors)/len(errors)),'bias':sum(errors)/len(errors)}
 for k,v in metrics.items():assert math.isclose(v,report['primary']['metrics'][label][k],rel_tol=1e-10,abs_tol=1e-10)
raw_checks=0
with zipfile.ZipFile(root/'raw-2024-2025.zip') as z:
 assert z.testzip() is None
 for year in [2024,2025]:
  manifest=json.loads((root/f'manifest-{year}.json').read_text(encoding='utf-8'))
  for c in manifest['chunks']:assert hashlib.sha256(z.read(f'{year}/'+c['file'])).hexdigest()==c['sha256'];raw_checks+=1
result={'status':'PASS','nearestAssignmentsVerified':assignment_checks,'rawFilesSha256Verified':raw_checks,'trainGroups':len(train),'testGroups':len(test),'scale':scale,'frozenModelHashUnchanged':True,'scientificValidation':False}
(root/'independent-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
