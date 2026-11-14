import {useState} from 'react';
import {useFireLens} from '../state/FireLensContext';
import {parseFirmsCsv,datasetFromFirms} from '../science/firms';
import {analyzeObservations} from '../science/analysis';
import {getRegionBoundaryGeoJson,isPointInGeometry} from '../map/realGeoBoundaries';
import {parseAndValidateFireLensJson} from '../data/adapters/pythonJsonAdapter';
import {OverpassCase} from './OverpassCase';
type StudyDetails={cohort?:string;metrics?:Record<string,{mae:number,rmse:number,bias:number}>;uncertainty?:{deltaRmse95:number[]}};

export function SciencePanel(){
 const {state,selectedRegion,activeRegionData,dispatch}=useFireLens();const ru=state.language==='ru';
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const [days,setDays]=useState(5);
 const [viirsSource,setViirsSource]=useState("VIIRS_NOAA20_NRT");
 const isOverpass=(state.scienceReport as {kind?:string}|undefined)?.kind==='overpass';
 const report=isOverpass?undefined:state.scienceReport as (ReturnType<typeof analyzeObservations>&StudyDetails)|undefined;
 async function archive(){setBusy(true);setMessage('');try{
  const responses=await Promise.all([fetch('/cases/kazakhstan-2024.json'),fetch('/cases/kazakhstan-2024-report.json')]);
  if(responses.some(r=>!r.ok))throw Error(ru?'Архивный кейс недоступен':'Archive case unavailable');
  const [text,caseReport]=await Promise.all([responses[0].text(),responses[1].json()]);const result=parseAndValidateFireLensJson(text);if(!result.ok)throw Error(result.error);
  const computed=analyzeObservations(result.dataset.dataByRegion.kazakhstan.hotspots);
  if(!computed.calibration||Math.abs(computed.calibration.scale-caseReport.calibration.scale)>1e-9)throw Error('Case reproducibility check failed');
  dispatch({type:'LOAD_DATASET_SUCCESS',dataset:result.dataset});dispatch({type:'SET_YEAR',year:2024});dispatch({type:'SCIENTIFIC_RESULT',report:{...caseReport,scientificallyValidated:false}});
  setMessage(ru?'Казахстан 2024 · научные продукты SP · type=0 · фильтр уверенности · контрольные суммы и метод в отчёте':'Kazakhstan 2024 · SP products · type=0 · confidence filtered · hashes and method in report');
 }catch(e){setMessage(String(e));}finally{setBusy(false);}}
 function load(texts:{text:string,sensor?:'MODIS'|'VIIRS'}[],source:string){
  const parsed=texts.map(p=>parseFirmsCsv(p.text,selectedRegion.id,p.sensor));
  const boundary=getRegionBoundaryGeoJson(selectedRegion).features[0]?.geometry;
  const b=selectedRegion.bounds;const seen=new Set<string>();let excluded=0,duplicates=0;
  const rows=parsed.flatMap(p=>p.observations).filter(r=>{
   if(r.lng<b.west||r.lng>b.east||r.lat<b.south||r.lat>b.north||boundary&&!isPointInGeometry(r.lng,r.lat,boundary)){excluded++;return false;}
   const k=[r.sensor,(r as any).satellite,r.date,r.acqTimeUtc,r.lat,r.lng].join('|');if(seen.has(k)){duplicates++;return false;}seen.add(k);return true;
  });
  const dataset=datasetFromFirms(state.dataset,selectedRegion,rows,source);
  dispatch({type:'LOAD_DATASET_SUCCESS',dataset});dispatch({type:'SET_YEAR',year:dataset.yearRange[1]});
  dispatch({type:'SCIENTIFIC_RESULT',report:analyzeObservations(rows)});
  setMessage(`${rows.length} ${ru?'записей':'records'} · ${parsed.reduce((s,p)=>s+p.rejected,0)} ${ru?'отклонено':'rejected'} · ${excluded} ${ru?'вне области':'outside area'} · ${duplicates} ${ru?'дублей':'duplicates'}`);
 }
 async function live(){setBusy(true);setMessage('');try{
  const b=selectedRegion.bounds;const bbox=[b.west,b.south,b.east,b.north].join(',');const texts=[];
  for(const source of ['MODIS_NRT',viirsSource]){const r=await fetch(`/api/firms?${new URLSearchParams({source,bbox,days:String(days)})}`);if(!r.ok){const e=await r.json();throw Error(e.error);}texts.push({text:await r.text(),sensor:source==='MODIS_NRT'?'MODIS' as const:'VIIRS' as const});if(source==='MODIS_NRT')await new Promise(r=>setTimeout(r,1300));}
  load(texts,`NASA FIRMS API · MODIS_NRT + ${viirsSource}`);
 }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <details className="firelens-panel rounded-2xl p-4 mt-4"><summary className="cursor-pointer font-semibold">{ru?'NASA FIRMS и экспериментальный анализ':'NASA FIRMS & exploratory analysis'}</summary>
 <p className="text-sm text-slate-400 my-3">{ru?'Анализ использует все загруженные записи региона; фильтры карты не меняют эксперимент. Реальные данные загружаются отдельно от DEMO. Детекции — тепловые аномалии, не границы пожаров. CSV пользователя не имеет независимо проверенного происхождения.':'Analysis uses all loaded regional records; map filters do not change this experiment. Real observations are separate from DEMO. Detections are thermal anomalies, not fire perimeters. User CSV provenance is not independently verified.'}</p>
 <div className="flex flex-wrap gap-3 items-center"><label>{ru?'Последние дни':'Recent days'} <input aria-label="Days" type="number" min="1" max="5" value={days} onChange={e=>setDays(Number(e.target.value))} className="w-16 bg-slate-900 p-1 border rounded"/></label>
 <label>VIIRS <select aria-label="VIIRS satellite" value={viirsSource} disabled={busy} onChange={e=>setViirsSource(e.target.value)} className="bg-slate-900 p-2 border rounded"><option value="VIIRS_NOAA20_NRT">NOAA-20</option><option value="VIIRS_NOAA21_NRT">NOAA-21</option><option value="VIIRS_SNPP_NRT">Suomi-NPP</option></select></label>
 <button disabled={busy} onClick={live} className="firelens-cta rounded-lg p-2 disabled:opacity-50">{busy?(ru?'Загрузка…':'Loading…'):(ru?'Загрузить MODIS + VIIRS':'Load MODIS + VIIRS')}</button>
 <button disabled={busy} onClick={archive} className="border border-emerald-400 rounded-lg p-2">{ru?'Кейс: Казахстан 2024':'Case: Kazakhstan 2024'}</button>
 <label className="border rounded-lg p-2 cursor-pointer">{ru?'Импорт FIRMS CSV':'Import FIRMS CSV'}<input type="file" accept=".csv,text/csv" multiple className="sr-only" disabled={busy} onChange={async e=>{const files=Array.from(e.target.files??[]);try{if(files.some(f=>f.size>15000000))throw Error('CSV limit: 15 MB/file');load(await Promise.all(files.map(async f=>({text:await f.text()}))),'User-provided FIRMS CSV · provenance unverified');}catch(err){setMessage(String(err));}e.target.value='';}}/></label>
 <button onClick={()=>dispatch({type:'SCIENTIFIC_RESULT',report:isOverpass?state.scienceReport:analyzeObservations(activeRegionData?.hotspots??[])})} className="border rounded-lg p-2">{ru?'Рассчитать':'Calculate'}</button>
 <button onClick={()=>{dispatch({type:'RESET_TO_DEMO'});setMessage('');}} className="border rounded-lg p-2">DEMO</button></div>
 {message&&<p role="status" className="my-3 text-sm">{message}</p>}
 {report&&<div className="mt-3 text-sm space-y-2"><strong>{report.scope} · {ru?'Экспериментальный результат. Научно не валидирован.':'Exploratory result. Not scientifically validated.'}</strong><p>{report.uniqueRecords} {ru?'уникальных записей':'unique records'} · {report.pairedCells} {ru?'пар ячейка/день':'cell/day pairs'}</p>
 {report.cohort&&<div className="rounded-xl border border-amber-400/40 p-3 space-y-2"><p>{report.cohort}</p><p>{ru?'Результат неустойчив: RMSE ниже в основной выборке, но абсолютное смещение хуже. При включении низкой уверенности RMSE ухудшается.':'Result is not robust: primary-cohort RMSE is lower, but absolute bias is worse. Including low-confidence detections worsens RMSE.'}</p>
 {report.uncertainty&&<p>{ru?'95% интервал разницы RMSE при повторной выборке по суткам':'95% day-block bootstrap interval for RMSE difference'}: [{report.uncertainty.deltaRmse95.map(n=>n.toFixed(2)).join(', ')}] MW. {ru?'Интервал включает ноль; устойчивое улучшение не установлено.':'Interval includes zero; robust improvement is not established.'}</p>}
 <a href="/cases/kazakhstan-2024-report.json" download className="underline">{ru?'Полный отчёт и чувствительность JSON':'Full report & sensitivity JSON'}</a></div>}
 {report.calibration?<p>MODIS × {report.calibration.scale.toFixed(4)} → VIIRS · MAE {report.calibration.mae.toFixed(3)} · RMSE {report.calibration.rmse.toFixed(3)} MW · raw RMSE {report.calibration.rawRmse.toFixed(3)} · bias {report.calibration.bias.toFixed(3)}<br/>Train: {report.calibration.trainSamples} (≤{report.calibration.trainEnd}) · holdout: {report.calibration.holdoutSamples} (≥{report.calibration.holdoutStart})</p>:<p>{ru?'Недостаточно перекрытия: нужны ≥6 дат, ≥5 обучающих и ≥3 отложенных пар. Метрики не рассчитаны.':'Insufficient overlap: requires ≥6 dates, ≥5 training and ≥3 holdout pairs. No metrics computed.'}</p>}
 <p>{ru?'Сетка 0,25° / сутки UTC; OLS через начало координат. Только ячейки с детекциями обоих сенсоров. Нет поправок на облака и пролёты. VIIRS — не наземная истина. Историческая экстраполяция отключена.':'0.25° grid / UTC day; OLS through origin. Only cells detected by both sensors. No cloud or overpass corrections. VIIRS is not ground truth. Historical extrapolation disabled.'}</p>
 <button className="underline" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='firelens-exploratory-report.json';a.click();URL.revokeObjectURL(url);}}>{ru?'Скачать результат JSON':'Download result JSON'}</button></div>}
 <OverpassCase />
 </details>;
}
