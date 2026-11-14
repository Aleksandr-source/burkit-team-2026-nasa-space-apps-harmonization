"""Independent standard-library check of exported pairs and raw download hashes."""
from pathlib import Path
import csv,json,math,hashlib,zipfile
root=Path(__file__).resolve().parent.parent/'study-2024'
if not root.exists():root=Path(__file__).resolve().parent
r=json.loads((root/'report.json').read_text(encoding='utf-8'))
pairs=list(csv.DictReader((root/'paired-bins.csv').open(encoding='utf-8')))
train=[p for p in pairs if p['split']=='train'];holdout=[p for p in pairs if p['split']=='holdout']
assert len(pairs)==r['pairedCells'];assert len(train)==r['calibration']['trainSamples'];assert len(holdout)==r['calibration']['holdoutSamples']
assert max(p['date'] for p in train)<min(p['date'] for p in holdout)
assert not ({p['date'] for p in train}&{p['date'] for p in holdout})
scale=sum(float(p['modisFrp'])*float(p['viirsFrp']) for p in train)/sum(float(p['modisFrp'])**2 for p in train)
assert math.isclose(scale,r['calibration']['scale'],rel_tol=1e-12)
for name,predict in [('identity',lambda p:float(p['modisFrp'])),('calibrated',lambda p:scale*float(p['modisFrp'])),('trainingMean',lambda p:sum(float(x['viirsFrp']) for x in train)/len(train))]:
 errors=[predict(p)-float(p['viirsFrp']) for p in holdout]
 checks={'mae':sum(abs(x) for x in errors)/len(errors),'rmse':math.sqrt(sum(x*x for x in errors)/len(errors)),'bias':sum(errors)/len(errors)}
 for key,value in checks.items():assert math.isclose(value,r['metrics'][name][key],rel_tol=1e-10,abs_tol=1e-10)
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(root/'raw-csv.zip') as z:
 assert z.testzip() is None
 for chunk in manifest['chunks']:assert hashlib.sha256(z.read(chunk['file'])).hexdigest()==chunk['sha256']
result={'independentMetricsCheck':'PASS','rawSha256Check':'PASS','rawFilesChecked':len(manifest['chunks']),'pairedRows':len(pairs),'trainRows':len(train),'holdoutRows':len(holdout),'scale':scale,'scientificValidation':False}
(root/'independent-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
