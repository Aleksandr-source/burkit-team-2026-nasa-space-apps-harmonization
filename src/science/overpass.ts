import type {HotspotObservation} from '../types/firelens';
export interface MatchRules {radiusKm:number;maxMinutes:number}
export interface OverpassGroup {aquaId:string;date:string;time:string;lat:number;lng:number;aquaFrp:number;viirsFrp:number;viirsCount:number;maxKm:number;maxMinutes:number}
export interface OverpassAssignment {aquaId:string;viirsId:string;aquaUtc:string;viirsUtc:string;aquaLat:number;aquaLng:number;viirsLat:number;viirsLng:number;viirsFrp:number;km:number;minutes:number}
export function distanceKm(lat1:number,lon1:number,lat2:number,lon2:number){const rad=Math.PI/180;const a=Math.sin((lat2-lat1)*rad/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lon2-lon1)*rad/2)**2;return 6371.0088*2*Math.asin(Math.min(1,Math.sqrt(a)));}
function stamp(r:HotspotObservation){return r.acqTimeUtc&&/^\d\d:\d\d$/.test(r.acqTimeUtc)?Date.parse(`${r.date}T${r.acqTimeUtc}:00Z`):NaN;}
function key(r:HotspotObservation){return [r.satellite,r.date,r.acqTimeUtc,r.lat,r.lng].join('|');}
export function matchOverpasses(rows:HotspotObservation[],rules:MatchRules){
 if(!(rules.radiusKm>0&&rules.maxMinutes>0&&Number.isFinite(rules.radiusKm)&&Number.isFinite(rules.maxMinutes)))throw Error('Positive finite match thresholds required');
 const valid=rows.filter(r=>Number.isFinite(stamp(r))&&(r.dayNight==='D'||r.dayNight==='N'));
 const aqua=valid.filter(r=>r.sensor==='MODIS'&&/^(Aqua|A)$/i.test(r.satellite??'')).sort((a,b)=>key(a).localeCompare(key(b)));
 const viirs=valid.filter(r=>r.sensor==='VIIRS'&&/^(N20|NOAA.?20)$/i.test(r.satellite??'')).sort((a,b)=>key(a).localeCompare(key(b)));
 const buckets=new Map<number,HotspotObservation[]>();for(const a of aqua){const bucket=Math.floor(stamp(a)/3600000);const list=buckets.get(bucket)??[];list.push(a);buckets.set(bucket,list);}
 const assignments:OverpassAssignment[]=[],groupMap=new Map<string,OverpassGroup>();const extent=Math.ceil(rules.maxMinutes/60)+1;
 for(const v of viirs){const vt=stamp(v),bucket=Math.floor(vt/3600000);let best:{a:HotspotObservation;km:number;minutes:number}|undefined;
  for(let b=bucket-extent;b<=bucket+extent;b++)for(const a of buckets.get(b)??[]){if(a.dayNight!==v.dayNight)continue;const minutes=Math.abs(stamp(a)-vt)/60000;if(minutes>rules.maxMinutes)continue;const km=distanceKm(a.lat,a.lng,v.lat,v.lng);if(km>rules.radiusKm)continue;
   if(!best||km<best.km||km===best.km&&(minutes<best.minutes||minutes===best.minutes&&key(a)<key(best.a)))best={a,km,minutes};
  }
  if(!best)continue;const {a,km,minutes}=best;const k=key(a);const g=groupMap.get(k)??{aquaId:a.id,date:a.date,time:a.acqTimeUtc!,lat:a.lat,lng:a.lng,aquaFrp:a.frpMw,viirsFrp:0,viirsCount:0,maxKm:0,maxMinutes:0};
  g.viirsFrp+=v.frpMw;g.viirsCount++;g.maxKm=Math.max(g.maxKm,km);g.maxMinutes=Math.max(g.maxMinutes,minutes);groupMap.set(k,g);
  assignments.push({aquaId:a.id,viirsId:v.id,aquaUtc:`${a.date}T${a.acqTimeUtc}:00Z`,viirsUtc:`${v.date}T${v.acqTimeUtc}:00Z`,aquaLat:a.lat,aquaLng:a.lng,viirsLat:v.lat,viirsLng:v.lng,viirsFrp:v.frpMw,km,minutes});
 }
 const groups=[...groupMap.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.lat-b.lat||a.lng-b.lng);
 return {rules,groups,assignments,aquaRecords:aqua.length,viirsRecords:viirs.length,matchedAqua:groups.length,matchedViirs:assignments.length,unmatchedAqua:aqua.length-groups.length,unmatchedViirs:viirs.length-assignments.length};
}
export function fitOverpassModel(groups:{aquaFrp:number;viirsFrp:number}[]){const denominator=groups.reduce((s,g)=>s+g.aquaFrp**2,0);if(groups.length<20||denominator<=0)return null;return {scale:groups.reduce((s,g)=>s+g.aquaFrp*g.viirsFrp,0)/denominator,trainingMean:groups.reduce((s,g)=>s+g.viirsFrp,0)/groups.length,trainingGroups:groups.length};}
export function evaluateOverpassModel(groups:{aquaFrp:number;viirsFrp:number}[],model:NonNullable<ReturnType<typeof fitOverpassModel>>){
 const metrics=(predict:(g:typeof groups[number])=>number)=>{const e=groups.map(g=>predict(g)-g.viirsFrp);return {n:e.length,mae:e.length?e.reduce((s,v)=>s+Math.abs(v),0)/e.length:null,rmse:e.length?Math.sqrt(e.reduce((s,v)=>s+v*v,0)/e.length):null,bias:e.length?e.reduce((s,v)=>s+v,0)/e.length:null};};
 return {calibrated:metrics(g=>g.aquaFrp*model.scale),identity:metrics(g=>g.aquaFrp),trainingMean:metrics(()=>model.trainingMean),predictions:groups.map(g=>g.aquaFrp*model.scale)};
}
