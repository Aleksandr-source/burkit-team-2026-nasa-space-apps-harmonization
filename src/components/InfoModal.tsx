import { useFireLens } from '../state/FireLensContext';
import { useEffect, useState } from 'react';
import {
  X,
  Info,
  Upload,
  Download,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  DataMode,
  DatasetProvenanceMetadata,
  SatelliteSensor,
  SensorMetadata,
} from '../types/firelens';

export type InfoTopic =
  | 'overview'
  | 'data-analysis'
  | 'harmonization'
  | 'harmonization-methodology'
  | 'dynamics'
  | 'comparison'
  | 'history'
  | 'confidence-scales';

interface InfoModalProps {
  topic: InfoTopic | null;
  onClose: () => void;
  dataMode: DataMode;
  provenance?: DatasetProvenanceMetadata;
  sensors?: Record<SatelliteSensor, SensorMetadata>;
}

const TOPIC_CONTENT: Record<InfoTopic,{title:string}> = {
overview:{title:'О платформе FireLens'},'data-analysis':{title:'Данные и фильтры'},harmonization:{title:'Экспериментальный анализ'},'harmonization-methodology':{title:'Метод и ограничения'},dynamics:{title:'Динамика пожаров'},comparison:{title:'Сравнение сенсоров'},history:{title:'Календарь активности'},'confidence-scales':{title:'Шкалы достоверности'}
};

export function InfoModal({
  topic,
  onClose,
  dataMode,
  provenance,
  sensors,
}: InfoModalProps) {
  const {state} = useFireLens();
  const ru=state.language==='ru';
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
    if (!topic) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [topic, onClose]);

  if (!topic) return null;
  const titles:Record<string,string>={overview:'About FireLens','data-analysis':'Data and filters',harmonization:'Experimental harmonization','harmonization-methodology':'Method and limitations',dynamics:'Fire dynamics',comparison:'Sensor comparison',history:'Activity calendar','confidence-scales':'Confidence scales'};
  const content: {title:string;summary:string;points:string[];methodologyDetails?:string[]} = ru ? {...TOPIC_CONTENT[topic], summary:'FireLens сопоставляет тепловые детекции MODIS и VIIRS. DEMO содержит синтетические данные. Реальные наблюдения импортируются через NASA FIRMS или CSV.',points:['MODIS: около 1 км; VIIRS: около 375 м. Шкалы confidence различаются.','Доступен экспериментальный OLS-анализ сумм FRP на сетке 0,25° за сутки UTC. Обучение и проверка разделены по датам.','Метрики отложенной выборки не подтверждают научную валидность. Не учитываются облака, углы обзора и число пролётов.','Историческая гармонизация, площадь пожаров и прогноз риска не рассчитаны.'],methodologyDetails:undefined} : {title:titles[topic],summary:'FireLens compares MODIS and VIIRS thermal detections. DEMO is synthetic; actual observations are imported from NASA FIRMS or CSV.', points:['MODIS: approximately 1 km; VIIRS: approximately 375 m. Confidence scales differ.','Exploratory OLS compares summed FRP in 0.25° cells per UTC day. Training and holdout use separate dates.','Internal holdout errors do not establish scientific validity. Clouds, viewing angle and overpass frequency are not corrected.','Historical harmonization, burned area and risk forecasts are not computed.'],methodologyDetails:undefined};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
      onClick={onClose}
    >
      <div
        className="firelens-panel w-full max-w-lg rounded-2xl p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-950/60 text-emerald-300">
              <Info className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="info-modal-title" className="font-display text-lg font-semibold text-white">
              {content.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ru?"Закрыть справку":"Close help"}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">{content.summary}</p>

        <ul className="mt-4 space-y-2.5 border-t border-slate-800 pt-4 text-sm text-slate-300">
          {content.points.map((pt, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>

        {content.methodologyDetails && (
          <div className="mt-4 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{expanded ? 'Скрыть этапы методологии' : 'Раскрыть методологию'}</span>
            </button>
            {expanded && (
              <div className="mt-2.5 space-y-2 rounded-xl border border-slate-800 bg-[#07111e]/80 p-3 text-xs leading-relaxed text-slate-300">
                {content.methodologyDetails.map((step, idx) => (
                  <p key={idx}>{step}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {provenance && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-[#07111e]/85 p-3.5 text-xs space-y-1.5">
            <div className="font-semibold text-slate-200">{ru?"Источник и прозрачность данных":"Source and transparency"}</div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>{ru?"Источник:":"Source:"}</span>
              <span className="text-right font-medium text-slate-200">{provenance.sourceName}</span>
            </div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>{ru?"Продукты:":"Products:"}</span>
              <span className="text-right text-slate-200">
                {provenance.productNames.join(' · ')}
              </span>
            </div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>{ru?"Период и единицы:":"Period and units:"}</span>
              <span className="text-right font-mono-tabular text-slate-200">
                {provenance.observationPeriod} ({provenance.metricUnit})
              </span>
            </div>
            <div className="flex justify-between gap-2 text-slate-400">
              <span>{ru?"Метод обработки:":"Processing method:"}</span>
              <span className="text-right text-slate-200">
                {provenance.processingMethod ?? (ru?"Не задано — ожидает Python":"Not supplied")}
              </span>
            </div>
            {sensors && (
              <div className="border-t border-slate-800/80 pt-1.5 text-[11px] text-slate-400">
                {sensors.MODIS.productName} ({sensors.MODIS.spatialResolutionM} м) ·{' '}
                {sensors.VIIRS.productName} ({sensors.VIIRS.spatialResolutionM} м)
              </div>
            )}
            {provenance.limitations.length > 0 && (
              <div className="border-t border-slate-800/80 pt-1.5 text-[11px] text-amber-200/85">
                {ru?"Ограничение:":"Limitation:"} {provenance.limitations[0]}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
          <span>
            {ru?"Режим данных:":"Data mode:"}{' '}
            <strong className={dataMode === 'demo' ? 'text-amber-300' : 'text-emerald-300'}>
              {dataMode === 'demo' ? (ru?"DEMO (демонстрация)":"DEMO (synthetic)") : (ru?"Реальные данные (JSON)":"Imported observations (JSON)")}
            </strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-4 py-1.5 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-900/70"
          >
            {ru?"Понятно":"Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FilterAndJsonModalProps {
  open: boolean;
  onClose: () => void;
  selectedYear: number;
  minIntensity: number;
  dateFrom: string | null;
  dateTo: string | null;
  timeStartHour: number;
  timeEndHour: number;
  onUpdateMinIntensity: (val: number) => void;
  onUpdateDateTimeFilter: (payload: {
    dateFrom?: string | null;
    dateTo?: string | null;
    timeStartHour?: number;
    timeEndHour?: number;
  }) => void;
  onClearTimeFilters: () => void;
  onUploadJsonFile: (file: File) => void;
  onDownloadTemplate: () => void;
  onResetToDemo: () => void;
  dataMode: DataMode;
  uploadError: string | null;
}

export function FilterAndJsonModal({
  open,
  onClose,
  selectedYear,
  minIntensity,
  dateFrom,
  dateTo,
  timeStartHour,
  timeEndHour,
  onUpdateMinIntensity,
  onUpdateDateTimeFilter,
  onClearTimeFilters,
  onUploadJsonFile,
  onDownloadTemplate,
  onResetToDemo,
  dataMode,
  uploadError,
}: FilterAndJsonModalProps) {
  const {state} = useFireLens();
  const ru=state.language==='ru';
  if (!open) return null;

  const yearMinDate = `${selectedYear}-01-01`;
  const yearMaxDate = `${selectedYear}-12-31`;
  const hasActiveFilter =
    Boolean(dateFrom) || Boolean(dateTo) || timeStartHour !== 0 || timeEndHour !== 24 || minIntensity > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-modal-title"
      onClick={onClose}
    >
      <div
        className="firelens-panel w-full max-w-md rounded-2xl p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="filter-modal-title" className="font-display text-base font-semibold text-white">
            {ru?"Фильтр очагов и загрузка JSON":"Detection filters and JSON import"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={ru?"Закрыть настройки фильтра":"Close filters"}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <label htmlFor="min-intensity-range">{ru?"Минимальная интенсивность очага":"Minimum display intensity"}</label>
              <span className="font-mono-tabular text-emerald-300">
                {Math.round(minIntensity * 100)}%
              </span>
            </div>
            <input
              id="min-intensity-range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(minIntensity * 100)}
              onChange={(e) => onUpdateMinIntensity(Number(e.target.value) / 100)}
              className="mt-2 w-full accent-emerald-400"
            />
          </div>

          <div className="border-t border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-200">
                {ru?"Окно дат и времени наблюдения (UTC)":"Observation dates and time (UTC)"}
              </span>
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={onClearTimeFilters}
                  className="text-[11px] font-medium text-emerald-300 hover:underline"
                >
                  {ru?"Сбросить":"Reset"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="modal-date-from" className="block text-[11px] text-slate-400">
                  {ru?"С даты":"From date"}
                </label>
                <input
                  id="modal-date-from"
                  type="date"
                  min={yearMinDate}
                  max={yearMaxDate}
                  value={dateFrom ?? ''}
                  onChange={(e) => onUpdateDateTimeFilter({ dateFrom: e.target.value || null })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#060f1b] px-2.5 py-1.5 font-mono-tabular text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="modal-date-to" className="block text-[11px] text-slate-400">
                  {ru?"По дату":"To date"}
                </label>
                <input
                  id="modal-date-to"
                  type="date"
                  min={yearMinDate}
                  max={yearMaxDate}
                  value={dateTo ?? ''}
                  onChange={(e) => onUpdateDateTimeFilter({ dateTo: e.target.value || null })}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#060f1b] px-2.5 py-1.5 font-mono-tabular text-xs text-slate-100 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: (ru?"Все сутки":"All day"), start: 0, end: 24 },
                { label: (ru?"День (04–16 UTC)":"Day (04\u201316 UTC)"), start: 4, end: 16 },
                { label: (ru?"Ночь (16–04 UTC)":"Night (16\u201304 UTC)"), start: 16, end: 4 },
              ].map((preset) => {
                const active = timeStartHour === preset.start && timeEndHour === preset.end;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      onUpdateDateTimeFilter({
                        timeStartHour: preset.start,
                        timeEndHour: preset.end,
                      })
                    }
                    aria-pressed={active}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-emerald-400/60 bg-emerald-950/70 text-emerald-300'
                        : 'border-slate-700 bg-[#060f1b] text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <p className="text-xs font-medium text-slate-200">
              {ru?"Загрузка данных Python (JSON)":"Import analysis JSON"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {ru?"Импортируйте JSON-файл, сформированный вашим Python-модулем гармонизации MODIS/VIIRS.":"Import a JSON file conforming to the FireLens data contract. Provenance and validation claims are supplied by the author."}
            </p>

            {uploadError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-950/50 px-3.5 py-2 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-900/60">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{ru?"Выбрать JSON-файл":"Choose JSON file"}</span>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadJsonFile(file);
                    e.target.value = '';
                  }}
                />
              </label>

              <button
                type="button"
                onClick={onDownloadTemplate}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{ru?"Шаблон JSON":"JSON template"}</span>
              </button>

              {dataMode === 'real' && (
                <button
                  type="button"
                  onClick={onResetToDemo}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3.5 py-2 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-900/40"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{ru?"Демо-данные":"Demo data"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-500/20 border border-emerald-400/60 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
          >
            {ru?"Готово":"Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
