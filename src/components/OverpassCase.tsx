import {useState} from 'react';
import {useFireLens} from '../state/FireLensContext';
import {parseAndValidateFireLensJson} from '../data/adapters/pythonJsonAdapter';
import {matchOverpasses,evaluateOverpassModel} from '../science/overpass';
type Score={n:number;mae:number|null;rmse:number|null;bias:number|null};
export interface OverpassReport {scientificallyValidated:boolean;protocolSha256:string;training:{trainingYear:number;testYear:number;fits:{model:{scale:number;trainingGroups:number}}[]};primary:{model:{scale:number;trainingGroups:number};summary:{matchedAqua:number;matchedViirs:number;unmatchedAqua:number;unmatchedViirs:number};metrics:{calibrated:Score;identity:Score;trainingMean:Score}};uncertainty:{days:number;deltaRmse95:number[]|null};internalImprovementSupported:boolean;unit:string}
export interface OverpassEnvelope {kind:'overpass';report:OverpassReport}
export function OverpassCase(){
 const {state,dispatch}=useFireLens();const ru=state.language==='ru';const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const envelope=state.scienceReport as OverpassEnvelope|undefined;const report=envelope?.kind==='overpass'?envelope.report:null;
 const format=(v:number|null)=>v===null?'—':v.toFixed(2);
 async function load(){setBusy(true);setError('');try{const responses=await Promise.all([fetch('/cases/aqua-noaa20-2025.json'),fetch('/cases/aqua-noaa20-report.json')]);if(responses.some(r=>!r.ok))throw Error(ru?'Кейс недоступен':'Case unavailable');
  const [text,result]=await Promise.all([responses[0].text(),responses[1].json()]);const data=parseAndValidateFireLensJson(text);if(!data.ok)throw Error(data.error);
  if(result.training.trainingYear!==2024||result.training.testYear!==2025||result.scientificallyValidated!==false||data.dataset.yearRange[0]!==2025)throw Error('Unexpected case contract');
  const matched=matchOverpasses(data.dataset.dataByRegion.kazakhstan.hotspots,result.primary.rules);const checked=evaluateOverpassModel(matched.groups,result.primary.model);
  if(matched.groups.length!==result.primary.summary.matchedAqua||checked.calibrated.rmse===null||Math.abs(checked.calibrated.rmse-result.primary.metrics.calibrated.rmse)>1e-8)throw Error('Case reproducibility check failed');
  dispatch({type:'LOAD_DATASET_SUCCESS',dataset:data.dataset});dispatch({type:'SET_YEAR',year:2025});dispatch({type:'SCIENTIFIC_RESULT',report:{kind:'overpass',report:result}});
 }catch(e){setError(String(e));}finally{setBusy(false);}}
 return <section className="mt-4 border-t border-slate-700 pt-4 space-y-3"><div className="flex flex-wrap items-center gap-3"><strong>Aqua ↔ NOAA-20 · 2024 → 2025</strong><button disabled={busy} onClick={load} className="border border-emerald-400 rounded-lg p-2">{busy?'…':ru?'Открыть проверку 2025':'Open 2025 test'}</button></div>
 <p className="text-sm text-slate-400">{ru?'Сопоставление по фактическому времени (до 60 мин) и расстоянию (до 2 км). Коэффициент рассчитан на 2024 году и зафиксирован до проверки 2025 года.':'Matched by actual UTC time (up to 60 min) and distance (up to 2 km). Coefficient fitted on 2024 and frozen before evaluating 2025.'}</p>
 {error&&<p role="alert">{error}</p>}
 {report&&<div className="space-y-3 text-sm"><strong>{ru?'Реальные архивные данные SP · научная валидация не установлена':'Real SP archive observations · scientific validation not established'}</strong>
 <p>{ru?'Обучение':'Training'} 2024: {report.primary.model.trainingGroups} {ru?'групп':'groups'} · {ru?'Проверка':'Test'} 2025: {report.primary.summary.matchedAqua} {ru?'групп Aqua':'Aqua groups'} / {report.primary.summary.matchedViirs} {ru?'детекций VIIRS':'VIIRS detections'}.</p>
 <p>Aqua × {report.primary.model.scale.toFixed(6)} → {ru?'сумма FRP сопоставленных VIIRS':'matched VIIRS FRP sum'}. {ru?'Единицы: MW на группу наблюдений, не энергия за сутки.':'Units: MW per matched observation group, not daily energy.'}</p>
 <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>{ru?'Метод':'Method'}</th><th>MAE</th><th>RMSE</th><th>Bias</th></tr></thead><tbody>{(['identity','calibrated','trainingMean'] as const).map(k=><tr key={k}><td>{({identity:ru?'Исходный Aqua':'Raw Aqua',calibrated:ru?'Калибровка 2024':'2024 calibration',trainingMean:ru?'Среднее VIIRS 2024':'2024 VIIRS mean'})[k]}</td><td>{format(report.primary.metrics[k].mae)}</td><td>{format(report.primary.metrics[k].rmse)}</td><td>{format(report.primary.metrics[k].bias)}</td></tr>)}</tbody></table></div>
 <div className="rounded-xl border border-amber-400/40 p-3 space-y-2"><p>{report.internalImprovementSupported?(ru?'На этой отложенной выборке поддерживается снижение RMSE относительно исходного Aqua. Это не подтверждение наземной точности.':'This held-out sample supports lower RMSE relative to raw Aqua. This does not establish ground-truth accuracy.'):(ru?'Устойчивое снижение RMSE на отложенной выборке не установлено.':'Robust held-out RMSE reduction is not established.')}</p>
 <p>{ru?'95% интервал ΔRMSE':'95% ΔRMSE interval'}: [{report.uncertainty.deltaRmse95?.map(v=>v.toFixed(2)).join(', ')??'—'}] MW · {report.uncertainty.days} {ru?'тестовых дат':'test dates'}.</p>
 <p>{ru?'Абсолютное смещение стало хуже. Преимущество перед средним по обучению небольшое. Облака, реальная площадь пикселя и ненаблюдаемые пожары не учтены; 2 км — условный порог, не контур пикселя.':'Absolute bias worsened. Advantage over the training-mean baseline is small. Clouds, actual pixel footprint and unobserved fires are not corrected; 2 km is a matching gate, not a pixel boundary.'}</p>
 <p>{ru?'Без пары':'Unmatched'}: Aqua {report.primary.summary.unmatchedAqua}, VIIRS {report.primary.summary.unmatchedViirs}. {ru?'На карте только сопоставленная тестовая подвыборка. Пропуски не равны нулевой активности.':'Map shows the matched test subset only. Missing comparisons are not zero fire activity.'}</p></div>
 <a href="/cases/aqua-noaa20-report.json" download className="underline">{ru?'Скачать полный отчёт JSON':'Download full report JSON'}</a>
 </div>}
 </section>;
}
