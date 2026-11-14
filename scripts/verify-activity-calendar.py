"""Independent raw-CSV verification of every calendar cell and exported dataset."""
from pathlib import Path
import json,csv,math,hashlib,datetime
project=Path(__file__).resolve().parent.parent;root=project/'activity-calendar';source=project/'study-overpasses'
c=json.loads((root/'calendar.json').read_text(encoding='utf-8'));audit=json.loads((root/'audit.json').read_text(encoding='utf-8'))
for f in audit['sourceFiles']:assert hashlib.sha256((source/f['file']).read_bytes()).hexdigest()==f['sha256']
rows=[];groups=[];coverage={}
for year in [2024,2025]:
 rows+=list(csv.DictReader((source/f'eligible-{year}.csv').open(encoding='utf-8')));coverage[year]={'MODIS':set(),'VIIRS':set()}
 m=json.loads((source/f'manifest-{year}.json').read_text(encoding='utf-8'))
 for chunk in m['chunks']:
  start=datetime.date.fromisoformat(chunk['date']);sensor='MODIS' if chunk['source']=='MODIS_SP' else 'VIIRS'
  coverage[year][sensor].update((start+datetime.timedelta(days=d)).isoformat() for d in range(chunk['days']))
 for sensor in ['MODIS','VIIRS']:assert len(coverage[year][sensor])==(366 if year==2024 else 365)
for split in ['train','test']:groups+=list(csv.DictReader((source/f'{split}-groups.csv').open(encoding='utf-8')))
scale=json.loads((source/'frozen-model.json').read_text(encoding='utf-8'))['fits'][0]['model']['scale'];assert math.isclose(scale,c['scale'],rel_tol=1e-12)
def eq(actual,expected):
 if expected is None:assert actual is None
 else:assert actual is not None and math.isclose(actual,expected,rel_tol=1e-10,abs_tol=1e-8)
checked=0
for resolution in ['months','weeks']:
 for year in [2024,2025]:
  periods=[p for p in c[resolution] if p['year']==year];assert len(periods)==(12 if resolution=='months' else 53)
  dates=[]
  for p in periods:
   start=datetime.date.fromisoformat(p['start']);end=datetime.date.fromisoformat(p['end']);days=(end-start).days+1;assert days==p['days'];dates.extend((start+datetime.timedelta(days=d)).isoformat() for d in range(days))
   rs=[r for r in rows if p['start']<=r['date']<=p['end']];gs=[g for g in groups if p['start']<=g['date']<=p['end']]
   for sensor,label in [('MODIS','aqua'),('VIIRS','viirs')]:
    a=[r for r in rs if r['sensor']==sensor];assert len(a)==p[label]['count'];eq(p[label]['frpSum'],sum(float(r['frpMw']) for r in a) if a else None)
    assert p['queryDays'][sensor]==sum(p['start']<=d<=p['end'] for d in coverage[year][sensor])
   assert p['queryComplete']==all(p['queryDays'][s]==days for s in ['MODIS','VIIRS'])
   assert p['matched']['groups']==len(gs);eq(p['matched']['aquaFrp'],sum(float(g['aquaFrp']) for g in gs) if gs else None);eq(p['matched']['viirsFrp'],sum(float(g['viirsFrp']) for g in gs) if gs else None);eq(p['matched']['scaledAquaFrp'],sum(float(g['aquaFrp'])*scale for g in gs) if gs else None);checked+=1
  assert len(dates)==len(set(dates))==(366 if year==2024 else 365);assert dates[0]==f'{year}-01-01';assert dates[-1]==f'{year}-12-31'
dataset=json.loads((project/'public/cases/calendar-2024-2025-dataset.json').read_text(encoding='utf-8'));points=dataset['dataByRegion']['kazakhstan']['hotspots'];lookup={r['id']:r for r in rows};assert len(points)==len(lookup)==76422
for p in points:
 r=lookup[p['id']];assert p['date']==r['date'] and p['sensor']==r['sensor'] and p['satellite']==r['satellite'];eq(p['frpMw'],float(r['frpMw']));eq(p['lat'],float(r['lat']));eq(p['lng'],float(r['lng']))
assert c['baselineAvailable'] is False and c['forecastAvailable'] is False and c['scientificallyValidated'] is False
result={'status':'PASS','calendarPeriodsChecked':checked,'rawRecordsChecked':len(points),'matchedGroups':len(groups),'inputSha256Checked':len(audit['sourceFiles']),'leapAndNormalYearTailsRetained':True,'noBaselineOrForecast':True,'actualSatelliteCoverageKnown':False,'scientificValidation':False}
(root/'independent-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
