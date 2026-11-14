import type {HotspotObservation} from '../types/firelens';
import {analyzeObservations} from './analysis';
export function prepareStudyCohort(input:HotspotObservation[],settings={vegetationOnly:true,excludeLowConfidence:true}){
 const seen=new Set<string>(),rows:HotspotObservation[]=[];
 const excluded={duplicates:0,nonVegetationOrUnknown:0,lowConfidence:0};
 for(const r of input){const id=[r.sensor,r.satellite,r.date,r.acqTimeUtc,r.lat,r.lng].join('|');if(seen.has(id)){excluded.duplicates++;continue;}seen.add(id);
  if(settings.vegetationOnly&&r.detectionType!==0){excluded.nonVegetationOrUnknown++;continue;}
  if(settings.excludeLowConfidence&&(r.sensor==='MODIS'?(r.modisConfidencePct??-1)<30:!['nominal','high'].includes(r.viirsConfidenceLevel??''))){excluded.lowConfidence++;continue;}
  rows.push(r);
 }
 return {rows,excluded};
}
export function evaluateStudy(rows:HotspotObservation[],fixedTrainEnd?:string){
 const core=analyzeObservations(rows),bins=new Map<string,{date:string,cellX:number,cellY:number,modisFrp:number,viirsFrp:number,m:number,v:number}>();
 for(const r of rows){const x=Math.floor((r.lng+180)/0.25),y=Math.floor((r.lat+90)/0.25),key=[r.date,x,y].join('|');const b=bins.get(key)??{date:r.date,cellX:x,cellY:y,modisFrp:0,viirsFrp:0,m:0,v:0};if(r.sensor==='MODIS'){b.modisFrp+=r.frpMw;b.m++;}else{b.viirsFrp+=r.frpMw;b.v++;}bins.set(key,b);}
 const matched=[...bins.values()].filter(b=>b.m>0&&b.v>0).sort((a,b)=>a.date.localeCompare(b.date)||a.cellX-b.cellX||a.cellY-b.cellY);
 if(fixedTrainEnd){
  const training=matched.filter(b=>b.date<=fixedTrainEnd),holdout=matched.filter(b=>b.date>fixedTrainEnd);
  core.calibration=null;
  const denominator=training.reduce((s,b)=>s+b.modisFrp**2,0);
  if(training.length>=5&&holdout.length>=3&&denominator>0){const scale=training.reduce((s,b)=>s+b.modisFrp*b.viirsFrp,0)/denominator;const errors=holdout.map(b=>scale*b.modisFrp-b.viirsFrp);
   core.calibration={scale,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/errors.length,rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),bias:errors.reduce((s,e)=>s+e,0)/errors.length,rawRmse:Math.sqrt(holdout.reduce((s,b)=>s+(b.modisFrp-b.viirsFrp)**2,0)/holdout.length),trainSamples:training.length,holdoutSamples:holdout.length,trainEnd:fixedTrainEnd,holdoutStart:holdout[0].date};
  }
  core.method='Exploratory FRP OLS; 0.25° / UTC day; fixed primary-cohort temporal cutoff';
 }
 const train=core.calibration?matched.filter(b=>b.date<=core.calibration!.trainEnd):[];
 const mean=train.length?train.reduce((s,b)=>s+b.viirsFrp,0)/train.length:null;
 const pairs=matched.map(b=>({...b,split:core.calibration?(b.date<=core.calibration.trainEnd?'train':'holdout'):'unfitted',predicted:core.calibration?b.modisFrp*core.calibration.scale:null,meanReference:mean}));
 const test=pairs.filter(b=>b.split==='holdout');
 function metrics(pred:(b:typeof pairs[number])=>number){const errors=test.map(b=>pred(b)-b.viirsFrp);const n=errors.length;return {n,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/n,rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/n),bias:errors.reduce((s,e)=>s+e,0)/n};}
 const scores=test.length?{calibrated:metrics(b=>b.predicted!),identity:metrics(b=>b.modisFrp),trainingMean:metrics(()=>mean!)}:null;
 return {...core,pairs,metrics:scores,trainingViirsMean:mean,occupiedBins:bins.size,unpairedBins:bins.size-matched.length};
}
