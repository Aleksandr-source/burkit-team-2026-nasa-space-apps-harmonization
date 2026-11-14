import type {HotspotObservation} from '../types/firelens';
import type {OverpassGroup} from './overpass';
export type CalendarResolution='month'|'week';
export type CalendarCoverage=Record<number,{MODIS:string[];VIIRS:string[]}>;
export interface CalendarPeriod {year:number;index:number;start:string;end:string;days:number}
export interface ActivityCell extends CalendarPeriod {aqua:{count:number;frpSum:number|null};viirs:{count:number;frpSum:number|null};matched:{groups:number;aquaFrp:number|null;scaledAquaFrp:number|null;viirsFrp:number|null};queryDays:{MODIS:number;VIIRS:number};queryComplete:boolean}
export interface ActivityCalendar {schemaVersion:'1';regionId:'kazakhstan';years:number[];scale:number;coverage:CalendarCoverage;months:ActivityCell[];weeks:ActivityCell[];baselineAvailable:false;forecastAvailable:false;scientificallyValidated:false;summary:{year:number;aquaRecords:number;viirsRecords:number;matchedGroups:number}[]}
export interface CalendarMatchLink {date:string;aquaId:string;viirsIds:string[]}
export function calendarEvidenceIds(rows:HotspotObservation[],links:CalendarMatchLink[],selection:{start:string;end:string;mode:'raw'|'matched';series:'aqua'|'viirs'|'scaled'}):string[]{
 if(selection.mode==='matched')return [...new Set(links.filter(g=>g.date>=selection.start&&g.date<=selection.end).flatMap(g=>[g.aquaId,...g.viirsIds]))];
 return rows.filter(r=>r.date>=selection.start&&r.date<=selection.end&&(selection.series==='aqua'?r.sensor==='MODIS':r.sensor==='VIIRS')).map(r=>r.id);
}
const day=86400000,iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
export function calendarPeriods(year:number,resolution:CalendarResolution):CalendarPeriod[]{
 if(!Number.isInteger(year)||year<2000||year>2100)throw Error('Invalid calendar year');const start=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1);const periods:CalendarPeriod[]=[];
 if(resolution==='month')for(let m=0;m<12;m++){const a=Date.UTC(year,m,1),b=Date.UTC(year,m+1,1);periods.push({year,index:m+1,start:iso(a),end:iso(b-day),days:(b-a)/day});}
 else for(let a=start;a<end;a+=7*day){const b=Math.min(a+7*day,end);periods.push({year,index:periods.length+1,start:iso(a),end:iso(b-day),days:(b-a)/day});}
 return periods;
}
export function buildActivityCalendar(rows:HotspotObservation[],groups:OverpassGroup[],options:{years:number[];scale:number;coverage:CalendarCoverage}):ActivityCalendar {
 if(!Number.isFinite(options.scale)||options.scale<0)throw Error('Invalid frozen scale');const years=[...new Set(options.years)].sort((a,b)=>a-b);
 const blank=(p:CalendarPeriod):ActivityCell=>{const covered=(sensor:'MODIS'|'VIIRS')=>new Set((options.coverage[p.year]?.[sensor]??[]).filter(d=>d>=p.start&&d<=p.end)).size;const queryDays={MODIS:covered('MODIS'),VIIRS:covered('VIIRS')};return {...p,aqua:{count:0,frpSum:null},viirs:{count:0,frpSum:null},matched:{groups:0,aquaFrp:null,scaledAquaFrp:null,viirsFrp:null},queryDays,queryComplete:queryDays.MODIS===p.days&&queryDays.VIIRS===p.days};};
 const months=years.flatMap(y=>calendarPeriods(y,'month').map(blank)),weeks=years.flatMap(y=>calendarPeriods(y,'week').map(blank));
 const byMonth=new Map(months.map(p=>[`${p.year}-${p.index}`,p])),byWeek=new Map(weeks.map(p=>[`${p.year}-${p.index}`,p]));
 const cells=(date:string)=>{const year=Number(date.slice(0,4));if(!years.includes(year))return [];const time=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(time)||iso(time)!==date)throw Error('Invalid observation date');return [byMonth.get(`${year}-${Number(date.slice(5,7))}`)!,byWeek.get(`${year}-${Math.floor((time-Date.UTC(year,0,1))/day/7)+1}`)!];};
 const seen=new Set<string>();
 for(const r of rows){if(!(r.sensor==='MODIS'?/^(Aqua|A)$/i:/^(N20|NOAA.?20)$/i).test(r.satellite??''))continue;
  const key=[r.sensor,r.satellite,r.date,r.acqTimeUtc,r.lat,r.lng].join('|');if(seen.has(key))throw Error('Duplicate calendar observation');seen.add(key);
  if(!Number.isFinite(r.frpMw)||r.frpMw<0)throw Error('Invalid FRP');for(const p of cells(r.date)){const series=r.sensor==='MODIS'?p.aqua:p.viirs;series.count++;series.frpSum=(series.frpSum??0)+r.frpMw;}
 }
 const matchedSeen=new Set<string>();for(const g of groups){if(matchedSeen.has(g.aquaId))throw Error('Duplicate Aqua match group');matchedSeen.add(g.aquaId);if(!Number.isFinite(g.aquaFrp)||!Number.isFinite(g.viirsFrp)||g.aquaFrp<0||g.viirsFrp<0)throw Error('Invalid matched FRP');for(const p of cells(g.date)){p.matched.groups++;p.matched.aquaFrp=(p.matched.aquaFrp??0)+g.aquaFrp;p.matched.viirsFrp=(p.matched.viirsFrp??0)+g.viirsFrp;p.matched.scaledAquaFrp=(p.matched.scaledAquaFrp??0)+g.aquaFrp*options.scale;}}
 return {schemaVersion:'1',regionId:'kazakhstan',years,scale:options.scale,coverage:options.coverage,months,weeks,baselineAvailable:false,forecastAvailable:false,scientificallyValidated:false,summary:years.map(year=>{const ps=months.filter(p=>p.year===year);return {year,aquaRecords:ps.reduce((s,p)=>s+p.aqua.count,0),viirsRecords:ps.reduce((s,p)=>s+p.viirs.count,0),matchedGroups:ps.reduce((s,p)=>s+p.matched.groups,0)};})};
}
export function sameActivityCalendar(a:ActivityCalendar,b:ActivityCalendar):boolean{
 const same=(x:unknown,y:unknown):boolean=>{if(typeof x==='number'&&typeof y==='number')return Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=1e-9*Math.max(1,Math.abs(x),Math.abs(y));if(Array.isArray(x)&&Array.isArray(y))return x.length===y.length&&x.every((v,i)=>same(v,y[i]));if(x&&y&&typeof x==='object'&&typeof y==='object'){const keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(k=>same((x as any)[k],(y as any)[k]));}return x===y;};
 return same(a,b);
}
