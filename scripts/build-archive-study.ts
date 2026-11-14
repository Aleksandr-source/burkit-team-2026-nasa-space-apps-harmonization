import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseFirmsCsv,datasetFromFirms} from '../src/science/firms';
import {loadDemoDataset,parseAndValidateFireLensJson} from '../src/data/adapters/pythonJsonAdapter';
import {getRegionBoundaryGeoJson,isPointInGeometry} from '../src/map/realGeoBoundaries';
import {prepareStudyCohort,evaluateStudy} from '../src/science/archiveStudy';
import type {HotspotObservation} from '../src/types/firelens';

const dir=path.resolve(process.env.FIRELENS_ARCHIVE_DIR??'work/archive-2024');
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(process.env.FIRELENS_STUDY_DIR??path.join(project,'study-2024'));
const publicDir=path.resolve(process.env.FIRELENS_CASE_DIR??path.join(project,'public/cases'));
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(publicDir,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const base=loadDemoDataset(),region=base.regions.find(r=>r.id==='kazakhstan')!,boundary=getRegionBoundaryGeoJson(region).features[0].geometry;
const all:HotspotObservation[]=[];
const integrity={chunks:0,requestedDaysBySource:{} as Record<string,number>,rawRows:0,rejected:0,outsideCountry:0,datesOutsideWindow:0,typeCounts:{} as Record<string,number>};
for(const source of ['MODIS_SP','VIIRS_NOAA20_SP']){
 const chunks=manifest.chunks.filter((c:any)=>c.source===source).sort((a:any,b:any)=>a.date.localeCompare(b.date));
 assert.equal(chunks.length,74);let expected=Date.UTC(2024,0,1),requested=0;
 for(const chunk of chunks){assert.equal(Date.parse(chunk.date),expected);expected+=chunk.days*86400000;requested+=chunk.days;
  const text=fs.readFileSync(path.join(dir,chunk.file),'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),chunk.sha256);
  const parsed=parseFirmsCsv(text,region.id,source==='MODIS_SP'?'MODIS':'VIIRS');integrity.chunks++;integrity.rawRows+=parsed.observations.length+parsed.rejected;integrity.rejected+=parsed.rejected;
  for(const row of parsed.observations){if(row.year!==2024||Date.parse(row.date)<Date.parse(chunk.date)||Date.parse(row.date)>=expected){integrity.datesOutsideWindow++;continue;}
   if(row.sensor==='VIIRS')assert.match(row.satellite??'',/^(N20|NOAA.?20)$/i);
   if(!isPointInGeometry(row.lng,row.lat,boundary)){integrity.outsideCountry++;continue;}
   const typeKey=`${row.sensor}:type${row.detectionType??'unknown'}`;integrity.typeCounts[typeKey]=(integrity.typeCounts[typeKey]??0)+1;
   all.push({...row,id:`archive-2024-${all.length}`});
  }
 }
 assert.equal(expected,Date.UTC(2025,0,1));assert.equal(requested,366);integrity.requestedDaysBySource[source]=requested;
}
assert.equal(integrity.rejected,0);assert.equal(integrity.datesOutsideWindow,0);
const primary=prepareStudyCohort(all),report=evaluateStudy(primary.rows);
const sensitivity=[{name:'Primary: type0, MODIS>=30, VIIRS nominal/high',settings:{vegetationOnly:true,excludeLowConfidence:true}},
 {name:'Type0, include low confidence',settings:{vegetationOnly:true,excludeLowConfidence:false}},
 {name:'All types, confidence filtered',settings:{vegetationOnly:false,excludeLowConfidence:true}}].map(({name,settings})=>{const c=prepareStudyCohort(all,settings),r=evaluateStudy(c.rows,report.calibration?.trainEnd);return {name,rows:c.rows.length,excluded:c.excluded,pairedCells:r.pairedCells,pairedDates:r.pairedDates,calibration:r.calibration,metrics:r.metrics};});
const test=report.pairs.filter(r=>r.split==='holdout');
// Day-block resampling describes internal test uncertainty, not ground-truth validity.
const groups=new Map<string,typeof test>();for(const row of test){const a=groups.get(row.date)??[];a.push(row);groups.set(row.date,a);}
const blocks=[...groups.values()];let seed=2024;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const deltas:number[]=[];
if(blocks.length>=10)for(let k=0;k<500;k++){let raw=0,fit=0,n=0;for(let j=0;j<blocks.length;j++)for(const b of blocks[Math.floor(rng()*blocks.length)]){raw+=(b.modisFrp-b.viirsFrp)**2;fit+=(b.predicted!-b.viirsFrp)**2;n++;}deltas.push(Math.sqrt(fit/n)-Math.sqrt(raw/n));}
deltas.sort((a,b)=>a-b);
const statistics={...report,pairs:undefined,cohort:'type=0 presumed vegetation; MODIS confidence>=30; VIIRS nominal/high; NOAA-20 only',integrity,exclusions:primary.excluded,sensorCounts:{MODIS:primary.rows.filter(r=>r.sensor==='MODIS').length,VIIRS:primary.rows.filter(r=>r.sensor==='VIIRS').length},sensitivity,uncertainty:deltas.length?{method:'500 deterministic resamples of entire holdout UTC-day blocks',seed:2024,holdoutDays:blocks.length,deltaRmse95:[deltas[Math.floor(deltas.length*.025)],deltas[Math.floor(deltas.length*.975)]],deltaDefinition:'calibrated RMSE minus identity RMSE; negative is lower internal error',warning:'Conditional on fitted model and observed holdout; no training uncertainty or field validation'}:null};
const dataset=datasetFromFirms(base,region,primary.rows,'NASA FIRMS SP · Kazakhstan 2024 · MODIS + VIIRS NOAA-20 · type0 / QA-filtered');
dataset.provenance.processingMethod='All 366 request days per sensor verified; SHA-256; country clipping; type0; native confidence filtering; deduplication. Exploratory analysis separate.';
dataset.provenance.limitations=['All query windows covered; actual cloud-free satellite coverage is unknown. No non-detection zero-fill.','type0 is presumed vegetation burning, including agricultural burning; not confirmed wildfire.','Standard-processing MODIS Terra/Aqua versus NOAA-20 VIIRS; unequal overpasses and resolution remain uncorrected.','Same-year temporal holdout and block bootstrap are internal checks, not scientific validation.'];
assert.equal(parseAndValidateFireLensJson(JSON.stringify(dataset)).ok,true);
const csvHeader=['date','cellX','cellY','modisFrp','viirsFrp','m','v','split','predicted','meanReference'];
fs.writeFileSync(path.join(out,'paired-bins.csv'),[csvHeader.join(','),...report.pairs.map(p=>csvHeader.map(k=>(p as any)[k]??'').join(','))].join('\n'));
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(statistics,null,2));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(publicDir,'kazakhstan-2024.json'),JSON.stringify(dataset));
fs.writeFileSync(path.join(publicDir,'kazakhstan-2024-report.json'),JSON.stringify(statistics,null,2));
console.log(JSON.stringify(statistics,null,2));
