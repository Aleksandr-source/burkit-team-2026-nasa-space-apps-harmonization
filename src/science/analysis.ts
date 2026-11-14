import type {HotspotObservation} from '../types/firelens';

/** Exploratory same-cell/day FRP comparison. No correction of cloud or overpass bias. */
export function analyzeObservations(input: HotspotObservation[]) {
 const seen=new Set<string>(); const rows=input.filter(r=>{
  const key=[r.sensor,(r as any).satellite ?? '',r.date,r.acqTimeUtc,r.lat,r.lng].join('|');
  if(seen.has(key)) return false; seen.add(key);return true;
 });
 const bins=new Map<string,{date:string,MODIS:number,VIIRS:number,m:number,v:number}>();
 for(const r of rows){const key=`${r.date}|${Math.floor((r.lng+180)/0.25)}|${Math.floor((r.lat+90)/0.25)}`;
  const b=bins.get(key)??{date:r.date,MODIS:0,VIIRS:0,m:0,v:0};b[r.sensor]+=r.frpMw;b[r.sensor==='MODIS'?'m':'v']++;bins.set(key,b);}
 const pairs=[...bins.values()].filter(b=>b.m>0&&b.v>0).sort((a,b)=>a.date.localeCompare(b.date));
 const dates=[...new Set(pairs.map(p=>p.date))];const split=Math.floor(dates.length*0.7);
 const train=pairs.filter(p=>p.date<(dates[split]??''));const holdout=pairs.filter(p=>p.date>=(dates[split]??''));
 let calibration:null|{scale:number,mae:number,rmse:number,bias:number,rawRmse:number,trainSamples:number,holdoutSamples:number,trainEnd:string,holdoutStart:string}=null;
 if(train.length>=5&&holdout.length>=3&&dates.length>=6){
  const denominator=train.reduce((s,p)=>s+p.MODIS*p.MODIS,0);
  if(denominator>0){const scale=train.reduce((s,p)=>s+p.MODIS*p.VIIRS,0)/denominator;
   const errors=holdout.map(p=>scale*p.MODIS-p.VIIRS);
   calibration={scale,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/errors.length,rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/errors.length),bias:errors.reduce((s,e)=>s+e,0)/errors.length,rawRmse:Math.sqrt(holdout.reduce((s,p)=>s+(p.MODIS-p.VIIRS)**2,0)/holdout.length),trainSamples:train.length,holdoutSamples:holdout.length,trainEnd:train.at(-1)!.date,holdoutStart:holdout[0].date};
  }
 }
 return {method:'Exploratory FRP OLS through origin; 0.25° grid / UTC day; chronological 70/30 date split',unit:'MW per occupied cell/day',scientificallyValidated:false,uniqueRecords:rows.length,duplicates:input.length-rows.length,pairedCells:pairs.length,pairedDates:dates.length,calibration,scope:rows.some(r=>r.dataStatus==='demo')?'DEMO':'Imported observations',limitations:['Only cells/days with detections by both sensors are paired; absence is not zero.','FRP sums mix overpasses; grid is not equal area. No cloud, view-angle, land-cover or temporal correction.','VIIRS is a comparison reference, not ground truth. Holdout metrics are internal checks.','No historical extrapolation, burned area or operational risk prediction.']};
}
