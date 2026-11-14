import type {HotspotObservation,FireLensDataset,RegionDefinition} from '../types/firelens';

function csvRows(text:string):string[][] {
 const rows:string[][]=[];let row:string[]=[];let cell='';let quote=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quote)throw new Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
export function parseFirmsCsv(text:string,regionId:string,sourceHint?:'MODIS'|'VIIRS') {
 const rows=csvRows(text.replace(/^\uFEFF/,''));const header=rows.shift()?.map(s=>s.trim().toLowerCase())??[];
 for(const k of ['latitude','longitude','acq_date','acq_time','frp','confidence'])if(!header.includes(k))throw new Error(`Missing FIRMS column: ${k}`);
 let rejected=0;const observations:HotspotObservation[]=[];
 for(const cells of rows){try{
  const r=Object.fromEntries(header.map((h,i)=>[h,cells[i]?.trim()??'']));
  const n=(k:string)=>{if(r[k]==='')throw Error('Missing value');const v=Number(r[k]);if(!Number.isFinite(v))throw Error('Invalid number');return v;};
  const lat=n('latitude'),lng=n('longitude'),frpMw=n('frp');
  if(Math.abs(lat)>90||Math.abs(lng)>180||frpMw<0)throw Error('Range');
  const date=r.acq_date;const dt=new Date(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(+dt)||dt.toISOString().slice(0,10)!==date)throw Error('Date');
  const tm=r.acq_time.padStart(4,'0');if(!/^\d{4}$/.test(tm)||Number(tm.slice(0,2))>23||Number(tm.slice(2))>59)throw Error('Time');
  const sat=r.satellite??'';const instrument=r.instrument?.toUpperCase();
  const sensor=sourceHint??(instrument==='MODIS'||/^(terra|aqua|t|a)$/i.test(sat)?'MODIS':instrument==='VIIRS'||/^(n|n20|n21|suomi.?npp|noaa.?20|noaa.?21)$/i.test(sat)||'bright_ti4' in r?'VIIRS':null);
  if(!sensor)throw Error('Unknown sensor');
  const conf=r.confidence.toLowerCase();const level=({l:'low',n:'nominal',h:'high',low:'low',nominal:'nominal',high:'high'} as const)[conf];
  const pct=sensor==='MODIS'?n('confidence'):null;if(sensor==='MODIS'&&(pct!<0||pct!>100)||sensor==='VIIRS'&&!level)throw Error('Confidence');
  const year=dt.getUTCFullYear(),month=dt.getUTCMonth()+1;
  const week=Math.min(52,Math.floor((+dt-Date.UTC(year,0,1))/604800000)+1);
  const detectionType=r.type!==undefined&&r.type!==''?Number(r.type):null;
  if(detectionType!==null&&![0,1,2,3].includes(detectionType))throw Error('Unknown detection type');
  observations.push({id:`firms-${regionId}-${observations.length}`,regionId,date,acqTimeUtc:tm.slice(0,2)+':'+tm.slice(2),year,month,week,lat,lng,sensor,frpMw,frpUnit:'MW',modisConfidencePct:pct,viirsConfidenceLevel:sensor==='VIIRS'?level!:null,intensity:Math.min(1,frpMw/150),dayNight:r.daynight==='D'?'D':r.daynight==='N'?'N':null,dataStatus:'real',satellite:sat,detectionType:detectionType as HotspotObservation['detectionType']});
 }catch{rejected++;}}
 return {observations,rejected};
}
export function datasetFromFirms(base:FireLensDataset,region:RegionDefinition,rows:HotspotObservation[],source:string):FireLensDataset {
 const years=[...new Set(rows.map(r=>r.year))].sort((a,b)=>a-b);const now=new Date().getUTCFullYear();
 const annualSeries=years.map(year=>{const rs=rows.filter(r=>r.year===year);const m=rs.filter(r=>r.sensor==='MODIS'),v=rs.filter(r=>r.sensor==='VIIRS');return {year,metricName:'Imported detections (partial coverage)',metricUnit:'observations',modisCount:m.length||null,viirsCount:v.length||null,harmonizedCount:null,modisMeanFrpMw:m.length?m.reduce((s,r)=>s+r.frpMw,0)/m.length:null,viirsMeanFrpMw:v.length?v.reduce((s,r)=>s+r.frpMw,0)/v.length:null,harmonizedMeanFrpMw:null,completenessStatus:'partial' as const,completenessNote:'Imported rows only. No coverage mask; no detections does not imply no fire.'};});
 const weeklyActivity=years.flatMap(year=>Array.from({length:52},(_,i)=>{const week=i+1;const rs=rows.filter(r=>r.year===year&&r.week===week);return {year,week,metricName:'Imported detections',metricUnit:'observations',modisCount:rs.filter(r=>r.sensor==='MODIS').length||null,viirsCount:rs.filter(r=>r.sensor==='VIIRS').length||null,rawValue:rs.length||null,harmonizedValue:null,baselinePeriod:null,comparableSeriesLabel:null,historicalBaseline:null,anomalyValue:null,anomalyPct:null,totalFrpMw:rs.length?rs.reduce((s,r)=>s+r.frpMw,0):null,completenessStatus:rs.length?'partial' as const:'missing' as const};}));
 return {...base,dataMode:'real',sourceName:source,generatedAt:new Date().toISOString(),yearRange:[years[0]??now,years.at(-1)??now],regions:[region],dataByRegion:{[region.id]:{regionId:region.id,hotspots:rows,annualSeries,weeklyActivity,harmonization:null}},provenance:{sourceName:source,productNames:[...new Set(rows.map(r=>r.sensor))],observationPeriod:rows.length?`${rows.map(r=>r.date).sort()[0]} / ${rows.map(r=>r.date).sort().at(-1)}`:'Empty response',metricName:'Imported detections',metricUnit:'observations / MW',processingMethod:'FIRMS CSV validation; spatial subset; exact duplicate removal',limitations:['User CSV provenance is not independently verified. NRT is preliminary.','No coverage mask, historical baseline or scientifically validated harmonization.']}};
}
