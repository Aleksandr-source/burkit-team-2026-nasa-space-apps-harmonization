import {
  Satellite,
  Calendar,
  SlidersHorizontal,
  Play,
  TrendingUp,
  ArrowRight,
  Check,
  Info,
  Loader2,
} from 'lucide-react';
import type {
  AnnualObservationPoint,
  DataMode,
  HarmonizationResult,
  SatelliteSensor,
} from '../types/firelens';
import type { InfoTopic } from './InfoModal';
import { DynamicsChart } from './charts/DynamicsChart';
import { FireLensSelect } from './FireLensSelect';
import { useFireLens } from '../state/FireLensContext';

interface RightAnalyticsPanelProps {
  selectedDateRange: [number, number];
  selectedYear: number;
  enabledSensors: Record<SatelliteSensor, boolean>;
  annualSeries: AnnualObservationPoint[];
  harmonization: HarmonizationResult | null;
  filteredCount: number;
  dataMode: DataMode;
  isAnalyzing: boolean;
  hasAnalyzed: boolean;
  onToggleSensor: (sensor: SatelliteSensor) => void;
  onSelectPeriod: (startYear: number, endYear: number) => void;
  onOpenFilterModal: () => void;
  onRunAnalysis: () => void;
  onSelectYear: (year: number) => void;
  onOpenInfo: (topic: InfoTopic) => void;
}

const PERIOD_OPTIONS = [
  { label: '2000 – 2026', start: 2000, end: 2026 },
  { label: '2012 – 2026', start: 2012, end: 2026 },
  { label: '2018 – 2026', start: 2018, end: 2026 },
  { label: '2020 – 2026', start: 2020, end: 2026 },
];

export function RightAnalyticsPanel({
  selectedDateRange,
  selectedYear,
  enabledSensors,
  annualSeries,
  harmonization,
  filteredCount,
  dataMode,
  isAnalyzing,
  hasAnalyzed,
  onToggleSensor,
  onSelectPeriod,
  onOpenFilterModal,
  onRunAnalysis,
  onSelectYear,
  onOpenInfo,
}: RightAnalyticsPanelProps) {
  const { t,state } = useFireLens();
  const periodValue = `${selectedDateRange[0]}-${selectedDateRange[1]}`;
  const periodOptions=PERIOD_OPTIONS.filter(o=>o.start>=state.dataset.yearRange[0]&&o.end<=state.dataset.yearRange[1]);
  if(!periodOptions.some(o=>o.start===selectedDateRange[0]&&o.end===selectedDateRange[1]))periodOptions.unshift({label:`${selectedDateRange[0]} – ${selectedDateRange[1]}`,start:selectedDateRange[0],end:selectedDateRange[1]});

  return (
    <aside className="flex flex-col gap-4">
      {/* Card 1: Данные и анализ */}
      <section className="firelens-panel relative z-20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Satellite className="h-4.5 w-4.5 text-[#6ee755]" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-white">
              {t('analytics.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenInfo('data-analysis')}
            aria-label="Info data and analysis"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/80 text-slate-300 hover:border-emerald-400/60 hover:text-white"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Sensor Toggles */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onToggleSensor('MODIS')}
            aria-pressed={enabledSensors.MODIS}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
              enabledSensors.MODIS
                ? 'border-[#5ee64d]/80 bg-emerald-950/50 text-white shadow-[0_0_14px_rgba(94,230,77,0.16)]'
                : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`flex h-4.5 w-4.5 items-center justify-center rounded-full ${
                enabledSensors.MODIS
                  ? 'bg-[#5ee64d] text-[#041309]'
                  : 'border border-slate-600 text-transparent'
              }`}
            >
              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
            </span>
            <span>MODIS</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleSensor('VIIRS')}
            aria-pressed={enabledSensors.VIIRS}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
              enabledSensors.VIIRS
                ? 'border-purple-400/80 bg-purple-950/40 text-white shadow-[0_0_14px_rgba(168,85,247,0.18)]'
                : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`flex h-4.5 w-4.5 items-center justify-center rounded-full ${
                enabledSensors.VIIRS
                  ? 'bg-purple-400 text-[#120720]'
                  : 'border border-slate-600 text-transparent'
              }`}
            >
              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
            </span>
            <span>VIIRS</span>
          </button>
        </div>

        {/* Period Selector + Filter/JSON button */}
        <div className="mt-3 flex items-center gap-2.5">
          <FireLensSelect
            variant="panel"
            mono
            ariaLabel={t('analytics.periodLabel')}
            value={periodValue}
            onChange={(nextVal) => {
              const [s, end] = nextVal.split('-').map(Number);
              if (!Number.isNaN(s) && !Number.isNaN(end)) {
                onSelectPeriod(s, end);
              }
            }}
            icon={<Calendar className="h-4 w-4 text-[#6ee755]" aria-hidden="true" />}
            options={periodOptions.map((opt) => ({
              value: `${opt.start}-${opt.end}`,
              label: opt.label,
            }))}
            className="flex-1 min-w-0"
          />

          <button
            type="button"
            onClick={onOpenFilterModal}
            aria-label={t('analytics.filtersButton')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700/80 bg-[#0b1829]/80 text-[#6ee755] transition-colors hover:border-emerald-400/60 hover:bg-emerald-950/50"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
          className="firelens-cta mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold tracking-wide disabled:opacity-70"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{t('analytics.analyzing')}</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              <span>{t('analytics.analyze')}</span>
            </>
          )}
        </button>

        {hasAnalyzed && (
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{t('analytics.sampleCount', { year: selectedYear })}</span>
            <span className="font-mono-tabular font-semibold text-emerald-300">
              {filteredCount}
            </span>
          </div>
        )}
      </section>

      {/* Card 2: Результат гармонизации */}
      <section className="firelens-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="h-4.5 w-4.5 text-[#6ee755]" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-white">
              {t('analytics.harmonizationTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenInfo('harmonization')}
            aria-label="Info harmonization"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-700/80 text-slate-300 hover:border-emerald-400/60 hover:text-white"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2.5">
          <div className="flex-1 rounded-xl border border-slate-700/70 bg-[#0b1829]/80 px-3.5 py-2.5 text-center">
            <div className="text-[11px] text-slate-400">{t('analytics.before')}</div>
            <div
              className="mt-0.5 font-mono-tabular text-lg font-bold text-slate-100"
              data-testid="harmonization-before-val"
            >
              {harmonization?.verified && harmonization.beforeValue != null
                ? `${harmonization.beforeValue}`
                : '—'}
            </div>
          </div>

          <ArrowRight className="h-4 w-4 shrink-0 text-[#6ee755]" aria-hidden="true" />

          <div className="flex-1 rounded-xl border border-emerald-400/45 bg-emerald-950/35 px-3.5 py-2.5 text-center">
            <div className="text-[11px] text-emerald-300">{t('analytics.after')}</div>
            <div
              className="mt-0.5 font-mono-tabular text-lg font-bold text-white"
              data-testid="harmonization-after-val"
            >
              {harmonization?.verified && harmonization.afterValue != null
                ? `${harmonization.afterValue}`
                : '—'}
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-[11px] leading-snug text-slate-400">
          {harmonization?.verified
            ? `${harmonization.metricName} (${harmonization.metricUnit}) · ${harmonization.methodName}${harmonization.methodVersion ? ` v${harmonization.methodVersion}` : ''}`
            : dataMode === 'demo'
              ? 'Harmonization awaiting scientific processing'
              : 'Harmonization module did not provide verified metrics'}
        </p>
      </section>

      {/* Card 3: Динамика пожаров */}
      <section className="firelens-panel flex flex-1 flex-col rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-white">
              {t('analytics.dynamicsTitle')}
            </h2>
            <button
              type="button"
              onClick={() => onOpenInfo('dynamics')}
              aria-label="Info dynamics"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700/80 text-slate-300 hover:border-emerald-400/60 hover:text-white"
            >
              <Info className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#38bdf8]" aria-hidden="true" />
              <span>MODIS</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#a855f7]" aria-hidden="true" />
              <span>VIIRS</span>
            </span>
          </div>
        </div>

        <div className="mt-2 h-[175px] w-full">
          <DynamicsChart
            annualSeries={annualSeries}
            enabledSensors={enabledSensors}
            selectedYear={selectedYear}
            onSelectYear={onSelectYear}
          />
        </div>
      </section>
    </aside>
  );
}
