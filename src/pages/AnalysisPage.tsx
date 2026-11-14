import { useMemo } from 'react';
import {
  Upload,
  Download,
  RotateCcw,
  MapPin,
  AlertTriangle,
  Database,
  ArrowUpRight,
  Info,
  X,
} from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { useFireLens } from '../state/FireLensContext';
import { computeObservationSummary } from '../data/adapters/pythonJsonAdapter';
import { EChartWrapper } from '../components/charts/EChartWrapper';
import type { InfoTopic } from '../components/InfoModal';

interface AnalysisPageProps {
  onOpenInfo: (topic: InfoTopic) => void;
}

export function AnalysisPage({ onOpenInfo }: AnalysisPageProps) {
  const {
    state,
    selectedRegion,
    activeRegionData,
    filteredHotspots,
    dispatch,
    uploadJsonFile,
    downloadJsonTemplate,
    t,
  } = useFireLens();

  const monthLabels = [
    t('months.0'),
    t('months.1'),
    t('months.2'),
    t('months.3'),
    t('months.4'),
    t('months.5'),
    t('months.6'),
    t('months.7'),
    t('months.8'),
    t('months.9'),
    t('months.10'),
    t('months.11'),
  ];

  const summary = useMemo(
    () =>
      computeObservationSummary(activeRegionData, {
        regionId: selectedRegion.id,
        regionBounds: selectedRegion.bounds,
        startYear: state.selectedDateRange[0],
        endYear: state.selectedDateRange[1],
        selectedYear: state.selectedYear,
        enabledSensors: state.enabledSensors,
        minIntensity: state.minIntensity,
        dateFrom: state.dateFrom,
        dateTo: state.dateTo,
        timeStartHour: state.timeStartHour,
        timeEndHour: state.timeEndHour,
        weekFilter: state.weekFilter,
      }),
    [
      activeRegionData,
      selectedRegion.id,
      selectedRegion.bounds,
      state.selectedDateRange,
      state.selectedYear,
      state.enabledSensors,
      state.minIntensity,
      state.dateFrom,
      state.dateTo,
      state.timeStartHour,
      state.timeEndHour,
      state.weekFilter,
    ]
  );

  const hasSubYearFilter =
    Boolean(state.dateFrom) ||
    Boolean(state.dateTo) ||
    state.timeStartHour !== 0 ||
    state.timeEndHour !== 24 ||
    state.weekFilter !== null ||
    state.minIntensity > 0;

  const monthlyOption: EChartsOption = useMemo(() => {
    const modisByMonth = new Array(12).fill(0);
    const viirsByMonth = new Array(12).fill(0);

    for (const h of filteredHotspots) {
      const idx = Math.min(11, Math.max(0, h.month - 1));
      if (h.sensor === 'MODIS') modisByMonth[idx] += 1;
      else viirsByMonth[idx] += 1;
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8, 17, 29, 0.96)',
        borderColor: 'rgba(74, 222, 128, 0.35)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
      },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: '#cbd5e1', fontSize: 11 },
      },
      grid: { top: 32, right: 16, bottom: 28, left: 38 },
      xAxis: {
        type: 'category',
        data: monthLabels,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'obs.',
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: 'MODIS',
          type: 'bar',
          data: state.enabledSensors.MODIS ? modisByMonth : [],
          itemStyle: { color: '#0ea5e9', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'VIIRS',
          type: 'bar',
          data: state.enabledSensors.VIIRS ? viirsByMonth : [],
          itemStyle: { color: '#a855f7', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [filteredHotspots, state.enabledSensors.MODIS, state.enabledSensors.VIIRS, monthLabels]);

  const frpOption: EChartsOption = useMemo(() => {
    const bins = ['0–25', '25–50', '50–80', '80–120', '120+ MW'];
    const counts = [0, 0, 0, 0, 0];
    for (const h of filteredHotspots) {
      if (h.frpMw < 25) counts[0] += 1;
      else if (h.frpMw < 50) counts[1] += 1;
      else if (h.frpMw < 80) counts[2] += 1;
      else if (h.frpMw < 120) counts[3] += 1;
      else counts[4] += 1;
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8, 17, 29, 0.96)',
        borderColor: 'rgba(74, 222, 128, 0.35)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
      },
      grid: { top: 20, right: 16, bottom: 28, left: 38 },
      xAxis: {
        type: 'category',
        data: bins,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' },
      },
      yAxis: {
        type: 'value',
        name: 'obs.',
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: 'Hotspots',
          type: 'bar',
          data: counts,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#f97316' },
                { offset: 1, color: '#facc15' },
              ],
            },
          },
        },
      ],
    };
  }, [filteredHotspots]);

  const isDemo = state.dataMode === 'demo';

  return (
    <div className="space-y-4">
      <section className="firelens-panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-emerald-300 font-medium">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {selectedRegion.name}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {state.selectedYear} · W{state.selectedWeek}
            </span>
            <span aria-hidden="true">·</span>
            <span className={isDemo ? 'text-amber-300' : 'text-emerald-300'}>
              {isDemo ? t('demoData') : state.dataset.sourceName}
            </span>
          </div>
          <h1 className="mt-1 font-display text-xl font-bold text-white">
            {t('analysisPage.title')}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => dispatch({ type: 'GO_TO_EVIDENCE_STEP', tab: 'history' })}
              className="rounded-lg border border-slate-700/80 bg-[#081523]/80 px-2.5 py-1 text-slate-300 hover:border-emerald-400/50 hover:text-white"
            >
              {t('tabs.history')} ({state.selectedYear} · W{state.selectedWeek})
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'GO_TO_EVIDENCE_STEP', tab: 'map' })}
              className="rounded-lg border border-slate-700/80 bg-[#081523]/80 px-2.5 py-1 text-slate-300 hover:border-emerald-400/50 hover:text-white"
            >
              {t('tabs.map')}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'GO_TO_EVIDENCE_STEP', tab: 'comparison' })}
              className="rounded-lg border border-slate-700/80 bg-[#081523]/80 px-2.5 py-1 text-slate-300 hover:border-emerald-400/50 hover:text-white"
            >
              {t('tabs.comparison')}
            </button>
            {hasSubYearFilter && (
              <button
                type="button"
                onClick={() => dispatch({ type: 'CLEAR_OBSERVATION_FILTERS' })}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/45 bg-emerald-950/50 px-2.5 py-1 text-emerald-200 hover:bg-emerald-900/60"
              >
                <span>
                  {t('analysisPage.activeFilter')}
                  {state.weekFilter !== null ? ` (W${state.weekFilter})` : ''}
                </span>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-950/60 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-900/70">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('analysisPage.uploadJson')}</span>
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadJsonFile(file);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={downloadJsonTemplate}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('analysisPage.downloadTemplate')}</span>
          </button>

          {!isDemo && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESET_TO_DEMO' })}
              className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3.5 py-2 text-xs font-medium text-amber-200 hover:bg-amber-900/40"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('analysisPage.resetToDemo')}</span>
            </button>
          )}
        </div>
      </section>

      {state.uploadError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-400" aria-hidden="true" />
          <span>{state.uploadError}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="firelens-panel rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t('analysisPage.modisSample', { year: state.selectedYear })}</span>
            <button
              type="button"
              onClick={() => onOpenInfo('data-analysis')}
              aria-label="Info MODIS"
              className="text-slate-400 hover:text-white"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-bold text-sky-300">
            {state.enabledSensors.MODIS
              ? `n = ${summary.modisFilteredCount}`
              : t('analysisPage.sensorDisabled')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {state.enabledSensors.MODIS
              ? summary.annualModisAggregate !== null
                ? `${t('analysisPage.annualAggregate')} ${summary.annualModisAggregate} obs. · ~1000m`
                : t('analysisPage.noObsForCalc')
              : t('analysisPage.sensorDisabled')}
          </div>
        </div>

        <div className="firelens-panel rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t('analysisPage.viirsSample', { year: state.selectedYear })}</span>
            <button
              type="button"
              onClick={() => onOpenInfo('data-analysis')}
              aria-label="Info VIIRS"
              className="text-slate-400 hover:text-white"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-bold text-purple-300">
            {!state.enabledSensors.VIIRS
              ? t('analysisPage.sensorDisabled')
              : state.selectedYear < 2012
                ? t('analysisPage.viirsUnavailable')
                : `n = ${summary.viirsFilteredCount}`}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {!state.enabledSensors.VIIRS
              ? t('analysisPage.sensorDisabled')
              : state.selectedYear < 2012
                ? t('analysisPage.viirsUnavailable')
                : summary.annualViirsAggregate !== null
                  ? `${t('analysisPage.annualAggregate')} ${summary.annualViirsAggregate} obs. · ~375m`
                  : t('analysisPage.noObsForCalc')}
          </div>
        </div>

        <div className="firelens-panel rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{t('analysisPage.meanFrp')}</span>
            <button
              type="button"
              onClick={() => onOpenInfo('data-analysis')}
              aria-label="Info FRP"
              className="text-slate-400 hover:text-white"
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-1 font-mono-tabular text-2xl font-bold text-amber-300">
            {summary.meanFrpMw !== null ? `${summary.meanFrpMw} MW` : t('analysisPage.noObsForCalc')}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {summary.frpSampleSize > 0
              ? `Sample on map (n = ${summary.frpSampleSize})`
              : t('analysisPage.noObsForCalc')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="firelens-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-white">
              {t('analysisPage.seasonalDist')}
            </h2>
            <span className="font-mono-tabular text-[11px] text-slate-400">
              n = {filteredHotspots.length}
            </span>
          </div>
          <div className="mt-3 h-60 w-full">
            {filteredHotspots.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {t('analysisPage.noObservationsTable')}
              </div>
            ) : (
              <EChartWrapper option={monthlyOption} ariaLabel="Seasonal monthly distribution" />
            )}
          </div>
        </section>

        <section className="firelens-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-white">
              {t('analysisPage.frpDist')}
            </h2>
            <span className="font-mono-tabular text-[11px] text-slate-400">
              n = {filteredHotspots.length}
            </span>
          </div>
          <div className="mt-3 h-60 w-full">
            {filteredHotspots.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {t('analysisPage.noObservationsTable')}
              </div>
            ) : (
              <EChartWrapper option={frpOption} ariaLabel="Radiative power histogram" />
            )}
          </div>
        </section>
      </div>

      <section className="firelens-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-white">
            {t('analysisPage.coordsTable', {
              count: Math.min(15, filteredHotspots.length),
              total: filteredHotspots.length,
            })}
          </h2>
          <span className="text-xs text-slate-400">
            {isDemo ? t('demoData') : state.dataset.sourceName}
          </span>
        </div>

        {filteredHotspots.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#07111e]/70 py-10 text-center">
            <Database className="h-7 w-7 text-slate-500" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-slate-200">
              {t('analysisPage.noObservationsTable')}
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-400">
              {t('analysisPage.noObservationsDesc', {
                region: selectedRegion.name,
                year: state.selectedYear,
              })}
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">{t('analysisPage.sensor')}</th>
                  <th className="py-2.5 pr-4 font-medium">{t('analysisPage.dateTime')}</th>
                  <th className="py-2.5 pr-4 font-medium">{t('analysisPage.coords')}</th>
                  <th className="py-2.5 pr-4 font-medium">{t('analysisPage.frp')}</th>
                  <th className="py-2.5 pr-4 font-medium">{t('analysisPage.confidence')}</th>
                  <th className="py-2.5 text-right font-medium">{t('tabs.map')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredHotspots.slice(0, 15).map((spot) => (
                  <tr key={spot.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 pr-4 font-medium">
                      <span className={spot.sensor === 'VIIRS' ? 'text-purple-300' : 'text-sky-300'}>
                        {spot.sensor}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono-tabular text-slate-300 whitespace-nowrap">
                      {spot.date} · {spot.acqTimeUtc ? `${spot.acqTimeUtc} UTC` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 font-mono-tabular text-slate-200 whitespace-nowrap">
                      {spot.lat.toFixed(3)}°, {spot.lng.toFixed(3)}°
                    </td>
                    <td className="py-2.5 pr-4 font-mono-tabular text-amber-300 whitespace-nowrap">
                      {spot.frpMw.toFixed(1)} MW
                    </td>
                    <td className="py-2.5 pr-4 font-mono-tabular text-emerald-300 whitespace-nowrap">
                      {spot.sensor === 'MODIS'
                        ? spot.modisConfidencePct !== null
                          ? `${spot.modisConfidencePct}% (MODIS)`
                          : '—'
                        : spot.viirsConfidenceLevel !== null
                          ? `${spot.viirsConfidenceLevel} (VIIRS)`
                          : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'INSPECT_OBSERVATION_ON_MAP', observation: spot })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-emerald-900/60"
                      >
                        <span>{t('analysisPage.showOnMap')}</span>
                        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
