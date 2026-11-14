import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseFirmsCsv,datasetFromFirms} from '../src/science/firms';
import {loadDemoDataset,parseAndValidateFireLensJson} from '../src/data/adapters/pythonJsonAdapter';
import {getRegionBoundaryGeoJson,isPointInGeometry} from '../src/map/realGeoBoundaries';
import {prepareStudyCohort} from '../src/science/archiveStudy';
import {matchOverpasses,fitOverpassModel,evaluateOverpassModel,type MatchRules} from '../src/science/overpass';
import type {HotspotObservation} from '../src/types/firelens';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.resolve(process.env.FIRELENS_OVERPASS_STUDY_DIR??path.join(project,'study-overpasses'));fs.mkdirSync(out,{recursive:true});
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
const protocolText=fs.readFileSync(path.join(project,'docs/aqua-noaa20-protocol.json'),'utf8'),protocol=JSON.parse(protocolText),protocolHash=hash(protocolText);
const base=loadDemoDataset(),region=base.regions.find(r=>r.id==='kazakhstan')!,geometry=getRegionBoundaryGeoJson(region).features[0].geometry;
function collect(year:number){const dir=path.resolve(`work/archive-${year}`),manifestText=fs.readFileSync(path.join(dir,'manifest.json'),'utf8'),manifest=JSON.parse(manifestText);const inside:HotspotObservation[]=[];let raw=0,outside=0,rejected=0;
 for(const source of ['MODIS_SP','VIIRS_NOAA20_SP']){let expected=Date.UTC(year,0,1);const chunks=manifest.chunks.filter((c:any)=>c.source===source).sort((a:any,b:any)=>a.date.localeCompare(b.date));assert.equal(chunks.length,year===2024?74:73);
  for(const chunk of chunks){assert.equal(Date.parse(chunk.date),expected);expected+=chunk.days*86400000;const text=fs.readFileSync(path.join(dir,chunk.file),'utf8');assert.equal(hash(text),chunk.sha256);const parsed=parseFirmsCsv(text,region.id,source==='MODIS_SP'?'MODIS':'VIIRS');raw+=parsed.observations.length+parsed.rejected;rejected+=parsed.rejected;
   for(const r of parsed.observations){assert.equal(r.year,year);assert.ok(Date.parse(r.date)>=Date.parse(chunk.date)&&Date.parse(r.date)<expected);if(r.sensor==='VIIRS')assert.match(r.satellite??'',/^(N20|NOAA.?20)$/i);if(!isPointInGeometry(r.lng,r.lat,geometry)){outside++;continue;}inside.push({...r,id:`${year}-${inside.length}`});}
  }assert.equal(expected,Date.UTC(year+1,0,1));
 }assert.equal(rejected,0);
 const cohort=prepareStudyCohort(inside);const selected=cohort.rows.filter(r=>(r.sensor==='MODIS'?/^(Aqua|A)$/i.test(r.satellite??''):/^(N20|NOAA.?20)$/i.test(r.satellite??''))&&r.acqTimeUtc&&(r.dayNight==='D'||r.dayNight==='N'));
 return {rows:selected,integrity:{year,rawRows:raw,outsideCountry:outside,rejected,insideCountry:inside.length,cohortExclusions:cohort.excluded,qaType0Rows:cohort.rows.length,nonTargetSatelliteOrMissingTimeDayNight:cohort.rows.length-selected.length,eligibleRows:selected.length,manifestSha256:hash(manifestText)}};
}
function writeCsv(name:string,rows:Record<string,unknown>[]){if(!rows.length){fs.writeFileSync(path.join(out,name),'');return;}const fields=Object.keys(rows[0]);fs.writeFileSync(path.join(out,name),[fields.join(','),...rows.map(r=>fields.map(k=>r[k]??'').join(','))].join('\n'));}
const rules:MatchRules[]=[protocol.primary,...protocol.predeclaredSensitivity].map(r=>({radiusKm:r.radiusKm,maxMinutes:r.maxMinutes}));
if(process.argv.includes('--train')){
 if(fs.existsSync(path.join(out,'frozen-model.json')))throw Error('Model already frozen. Use a different FIRELENS_OVERPASS_STUDY_DIR for reproduction; never overwrite the reviewed model.');
 const training=collect(2024);const fits=rules.map(rule=>{const matches=matchOverpasses(training.rows,rule),model=fitOverpassModel(matches.groups);if(!model)throw Error('Insufficient training matches');return {rules:rule,model,summary:{aquaRecords:matches.aquaRecords,viirsRecords:matches.viirsRecords,matchedAqua:matches.matchedAqua,matchedViirs:matches.matchedViirs,unmatchedAqua:matches.unmatchedAqua,unmatchedViirs:matches.unmatchedViirs}};});
 const primary=matchOverpasses(training.rows,rules[0]);writeCsv('train-groups.csv',primary.groups);writeCsv('train-assignments.csv',primary.assignments);
 const frozen={protocolSha256:protocolHash,frozenAt:new Date().toISOString(),trainingYear:2024,testYear:2025,integrity:training.integrity,fits,scientificallyValidated:false};fs.writeFileSync(path.join(out,'frozen-model.json'),JSON.stringify(frozen,null,2));fs.writeFileSync(path.join(out,'protocol.json'),protocolText);console.log(JSON.stringify(frozen,null,2));
}else if(process.argv.includes('--evaluate')){
 const frozenText=fs.readFileSync(path.join(out,'frozen-model.json'),'utf8'),frozen=JSON.parse(frozenText);assert.equal(frozen.protocolSha256,protocolHash);
 const test=collect(2025);const evaluated=frozen.fits.map((fit:any)=>{const matched=matchOverpasses(test.rows,fit.rules),metrics=evaluateOverpassModel(matched.groups,fit.model);return {rules:fit.rules,model:fit.model,summary:{aquaRecords:matched.aquaRecords,viirsRecords:matched.viirsRecords,matchedAqua:matched.matchedAqua,matchedViirs:matched.matchedViirs,unmatchedAqua:matched.unmatchedAqua,unmatchedViirs:matched.unmatchedViirs},metrics:{...metrics,predictions:undefined}};});
 const primary=matchOverpasses(test.rows,frozen.fits[0].rules),fit=frozen.fits[0].model;
 const groups=primary.groups.map(g=>({...g,predicted:g.aquaFrp*fit.scale,trainingMean:fit.trainingMean}));writeCsv('test-groups.csv',groups);writeCsv('test-assignments.csv',primary.assignments);
 const byDay=new Map<string,typeof groups>();for(const g of groups){const a=byDay.get(g.date)??[];a.push(g);byDay.set(g.date,a);}const days=[...byDay.values()];let seed=2024;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const deltas:number[]=[];
 if(days.length>=10)for(let i=0;i<500;i++){let a=0,b=0,n=0;for(let j=0;j<days.length;j++)for(const g of days[Math.floor(rng()*days.length)]){a+=(g.predicted-g.viirsFrp)**2;b+=(g.aquaFrp-g.viirsFrp)**2;n++;}deltas.push(Math.sqrt(a/n)-Math.sqrt(b/n));}deltas.sort((a,b)=>a-b);
 const errors=groups.map(g=>({...g,error:g.predicted-g.viirsFrp,absoluteError:Math.abs(g.predicted-g.viirsFrp)})).sort((a,b)=>b.absoluteError-a.absoluteError).slice(0,20);writeCsv('largest-test-errors.csv',errors);
 const primaryMetrics=evaluated[0].metrics;const ci=deltas.length?[deltas[Math.floor(.025*deltas.length)],deltas[Math.floor(.975*deltas.length)]]:null;
 const better=primaryMetrics.calibrated.rmse<primaryMetrics.identity.rmse&&ci&&ci[1]<0;
 const report={study:'Aqua/NOAA-20 overpass matching; train 2024, test 2025',protocolSha256:protocolHash,frozenModelSha256:hash(frozenText),scientificallyValidated:false,unit:'MW per matched Aqua-pixel / VIIRS-neighborhood observation',training:frozen,testIntegrity:test.integrity,primary:evaluated[0],sensitivity:evaluated.slice(1),uncertainty:{method:'500 holdout UTC-day-block bootstrap resamples, conditional on frozen model; seed 2024',days:days.length,deltaRmse95:ci},internalImprovementSupported:Boolean(better),largestErrors:errors,limitations:protocol.limitations};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 const matchedIds=new Set([...primary.groups.map(g=>g.aquaId),...primary.assignments.map(a=>a.viirsId)]);const mapRows=test.rows.filter(r=>matchedIds.has(r.id));const dataset=datasetFromFirms(base,region,mapRows,'NASA FIRMS SP · Aqua/NOAA-20 matched subset · 2025 test');dataset.provenance.processingMethod='Frozen 2024 OLS; 2025 actual timestamps, nearest Aqua assignment ≤2 km / ≤60 min; type0 and native confidence QA';dataset.provenance.limitations=protocol.limitations;
 assert.ok(parseAndValidateFireLensJson(JSON.stringify(dataset)).ok);const publicDir=path.join(project,'public/cases');fs.mkdirSync(publicDir,{recursive:true});fs.writeFileSync(path.join(publicDir,'aqua-noaa20-2025.json'),JSON.stringify(dataset));fs.writeFileSync(path.join(publicDir,'aqua-noaa20-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({primary:report.primary,uncertainty:report.uncertainty,internalImprovementSupported:report.internalImprovementSupported,testIntegrity:report.testIntegrity,mapRecords:mapRows.length},null,2));
}else if(process.argv.includes('--audit-inputs')){
 // Audit export only: deliberately does not write frozen-model.json or refit.
 for(const year of [2024,2025]){const cohort=collect(year);writeCsv(`eligible-${year}.csv`,cohort.rows.map(r=>({id:r.id,sensor:r.sensor,satellite:r.satellite,date:r.date,acqTimeUtc:r.acqTimeUtc,lat:r.lat,lng:r.lng,frpMw:r.frpMw,dayNight:r.dayNight,detectionType:r.detectionType,modisConfidencePct:r.modisConfidencePct,viirsConfidenceLevel:r.viirsConfidenceLevel})));fs.copyFileSync(path.resolve(`work/archive-${year}/manifest.json`),path.join(out,`manifest-${year}.json`));}
 console.log('Audit inputs exported without refitting');
}else throw Error('Use --train first, then --evaluate; never refit after viewing test results');
