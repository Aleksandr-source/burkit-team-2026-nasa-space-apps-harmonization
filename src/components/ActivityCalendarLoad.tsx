import {useState} from 'react';
import {useFireLens} from '../state/FireLensContext';
import {parseAndValidateFireLensJson} from '../data/adapters/pythonJsonAdapter';
import {buildActivityCalendar,sameActivityCalendar,type ActivityCalendar,type CalendarMatchLink} from '../science/calendar';
import {matchOverpasses} from '../science/overpass';
export function ActivityCalendarLoad(){
 const {state,dispatch}=useFireLens();const ru=state.language==='ru';const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function load(){setBusy(true);setError('');try{const responses=await Promise.all([fetch('/cases/calendar-2024-2025-dataset.json'),fetch('/cases/calendar-2024-2025.json')]);if(responses.some(r=>!r.ok))throw Error(ru?'Календарь недоступен':'Calendar unavailable');
  const [text,expected]=await Promise.all([responses[0].text(),responses[1].json() as Promise<ActivityCalendar>]);const parsed=parseAndValidateFireLensJson(text);if(!parsed.ok)throw Error(parsed.error);
  if(expected.schemaVersion!=='1'||expected.years.join(',')!=='2024,2025'||expected.scientificallyValidated!==false)throw Error('Unexpected calendar contract');
  const rows=parsed.dataset.dataByRegion.kazakhstan.hotspots;const results=expected.years.map(year=>matchOverpasses(rows.filter(r=>r.year===year),{radiusKm:2,maxMinutes:60}));
  const calendar=buildActivityCalendar(rows,results.flatMap(r=>r.groups),{years:expected.years,scale:expected.scale,coverage:expected.coverage});
  if(!sameActivityCalendar(calendar,expected))throw Error('Calendar reproducibility check failed');
  const matches:CalendarMatchLink[]=results.flatMap(result=>{const byId=new Map(result.groups.map(g=>[g.aquaId,{date:g.date,aquaId:g.aquaId,viirsIds:[] as string[]}]));for(const a of result.assignments)byId.get(a.aquaId)!.viirsIds.push(a.viirsId);return [...byId.values()];});
  dispatch({type:'LOAD_ACTIVITY_CALENDAR',dataset:parsed.dataset,calendar,matches});
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 return <section className="firelens-panel rounded-2xl p-4 space-y-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{ru?'Реальный календарь NASA · Казахстан 2024–2025':'Real NASA calendar · Kazakhstan 2024–2025'}</strong><p className="mt-1 text-xs text-slate-400">{ru?'Полная QA-выборка Aqua / NOAA-20; сопоставления отдельно. Без исторической нормы и прогноза.':'Full Aqua / NOAA-20 QA cohort; matched groups shown separately. No historical baseline or forecast.'}</p></div><button disabled={busy} onClick={load} className="firelens-cta rounded-xl px-4 py-2 text-sm disabled:opacity-50">{busy?(ru?'Загрузка и проверка…':'Loading & checking…'):(ru?'Открыть реальный календарь':'Open real calendar')}</button></div>{error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}</section>;
}
