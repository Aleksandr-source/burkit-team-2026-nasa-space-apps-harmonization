import { useMemo, useState } from 'react';
import {
  Info,
  CalendarDays,
  ArrowRight,
  Lock,
  FileSearch,
  ChevronUp,
} from 'lucide-react';
import { useFireLens } from '../state/FireLensContext';
import { HistoryHeatmapChart } from '../components/charts/HistoryHeatmapChart';
import {ActivityCalendarLoad} from '../components/ActivityCalendarLoad';
import {ActivityCalendarPage} from './ActivityCalendarPage';
import { buildAnomalyExplanation } from '../data/anomalyExplainer';
import type { HistoryMetricMode, WeeklyActivityPoint } from '../types/firelens';
import type { InfoTopic } from '../components/InfoModal';

interface HistoryPageProps {
  onOpenInfo: (topic: InfoTopic) => void;
}

export function HistoryPage({ onOpenInfo }: HistoryPageProps) {
  const { state, selectedRegion, activeRegionData, dispatch, t } = useFireLens();
  const [explainOpen, setExplainOpen] = useState(false);

  const [startYear, endYear] = state.selectedDateRange;

  const MODE_OPTIONS: { id: HistoryMetricMode; labelKey: string }[] = [
    { id: 'raw', labelKey: 'historyPage.modeRaw' },
    { id: 'harmonized', labelKey: 'historyPage.modeHarmonized' },
    { id: 'anomaly', labelKey: 'historyPage.modeAnomaly' },
  ];

  const weeklyRows = useMemo(() => {
    if (!activeRegionData) return [];
    return activeRegionData.weeklyActivity.filter(
      (w) => w.year >= startYear && w.year <= endYear
    );
  }, [activeRegionData, startYear, endYear]);

  const hasHarmonizedWeekly = useMemo(
    () =>
      Boolean(activeRegionData?.harmonization?.verified) &&
      weeklyRows.some((w) => w.harmonizedValue !== null),
    [activeRegionData?.harmonization?.verified, weeklyRows]
  );

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const r of weeklyRows) set.add(r.year);
    return Array.from(set).sort((a, b) => a - b);
  }, [weeklyRows]);

  const activeRecord: WeeklyActivityPoint | undefined = useMemo(() => {
    return (
      weeklyRows.find((r) => r.year === state.selectedYear && r.week === state.selectedWeek) ??
      weeklyRows.find((r) => r.year === state.selectedYear) ??
      weeklyRows[0]
    );
  }, [weeklyRows, state.selectedYear, state.selectedWeek]);

  const explanation = useMemo(() => {
    if (!activeRecord) return null;
    return buildAnomalyExplanation({
      region: selectedRegion,
      record: activeRecord,
      harmonization: activeRegionData?.harmonization ?? null,
      enabledSensors: state.enabledSensors,
      dataMode: state.dataMode,
      language: state.language,
    });
  }, [
    activeRecord,
    selectedRegion,
    activeRegionData?.harmonization,
    state.enabledSensors,
    state.dataMode,
    state.language,
  ]);

  const handleSelectCell = (year: number, week: number) => {
    dispatch({ type: 'SET_WEEK', week });
    dispatch({ type: 'SET_YEAR', year });
  };

  const isDemo = state.dataMode === 'demo';
  if(state.activityCalendar)return <ActivityCalendarPage />;

  return (
    <div className="space-y-4">
      <ActivityCalendarLoad />
      <section className="firelens-panel flex flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center lg:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-950/60 text-emerald-300">
            <CalendarDays className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold text-white">
                {t('historyPage.title')}
              </h1>
              <button
                type="button"
                onClick={() => onOpenInfo('history')}
                aria-label="Info history"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:border-emerald-400/60 hover:text-white"
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              {selectedRegion.name} · Years {startYear}–{endYear} · Selected:{' '}
              <span className="font-mono-tabular text-emerald-300">
                {state.selectedYear} · W{state.selectedWeek}
              </span>{' '}
              · {isDemo ? t('demoData') : state.dataset.sourceName}
            </p>
          </div>
        </div>

        {/* 3-Mode Calendar Toggle */}
        <div
          role="group"
          aria-label="History metric mode"
          className="inline-flex flex-wrap rounded-xl border border-slate-700/80 bg-[#060f1b] p-1 self-start lg:self-auto"
        >
          {MODE_OPTIONS.map((opt) => {
            const isHarmDisabled = opt.id === 'harmonized' && !hasHarmonizedWeekly;
            const effectiveMode =
              state.historyMetricMode === 'harmonized' && !hasHarmonizedWeekly
                ? 'raw'
                : state.historyMetricMode;
            const isActive = effectiveMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isHarmDisabled}
                aria-disabled={isHarmDisabled}
                onClick={() => dispatch({ type: 'SET_HISTORY_METRIC_MODE', mode: opt.id })}
                aria-pressed={isActive}
                title={isHarmDisabled ? t('comparisonPage.lockedTooltip') : undefined}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  isHarmDisabled
                    ? 'cursor-not-allowed text-slate-600 border border-transparent opacity-70'
                    : isActive
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-400/60'
                      : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {isHarmDisabled && <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />}
                <span>{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!hasHarmonizedWeekly && (
        <div
          data-testid="history-harmonization-locked"
          className="flex items-center gap-2.5 rounded-xl border border-slate-700/80 bg-[#081523]/75 px-4 py-2 text-[11px] text-slate-300"
        >
          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span>{t('historyPage.lockedNotice')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
        <section className="firelens-panel rounded-2xl p-4 sm:p-5">
          <div className="h-[460px] w-full">
            <HistoryHeatmapChart
              weeklyRows={weeklyRows}
              years={years}
              metricMode={state.historyMetricMode}
              selectedYear={state.selectedYear}
              selectedWeek={state.selectedWeek}
              dataMode={state.dataMode}
              onSelectCell={handleSelectCell}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-slate-800/70 pt-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-slate-600 bg-[#070d16]" aria-hidden="true" />
              <span>{t('historyPage.legendNoObs')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-amber-400/75 bg-slate-800" aria-hidden="true" />
              <span>{t('historyPage.legendPartial')}</span>
            </span>
            {state.historyMetricMode === 'anomaly' && activeRecord?.comparableSeriesLabel && (
              <span className="text-slate-300">
                {t('historyPage.anomalyBase')} {activeRecord.comparableSeriesLabel} ({activeRecord.baselinePeriod ?? '2000–2020'})
              </span>
            )}
          </div>
        </section>

        <aside className="firelens-panel flex flex-col justify-between rounded-2xl p-4 sm:p-5">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              {t('historyPage.periodDetails')}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Click any cell in the matrix to inspect week details.
            </p>

            {activeRecord ? (
              <div className="mt-4 space-y-3" data-testid="history-period-details">
                <div className="rounded-xl border border-emerald-400/35 bg-emerald-950/35 p-3.5">
                  <div className="flex items-center justify-between text-xs text-emerald-300">
                    <span>{t('historyPage.selectedPeriod')}</span>
                    <span className="font-mono-tabular">
                      {activeRecord.completenessStatus === 'missing'
                        ? t('historyPage.missing')
                        : activeRecord.completenessStatus === 'partial'
                          ? t('historyPage.partial')
                          : t('historyPage.complete')}
                    </span>
                  </div>
                  <div className="mt-1 font-mono-tabular text-xl font-bold text-white">
                    {activeRecord.year} · Week W{activeRecord.week}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-slate-800 bg-[#081523]/80 p-3">
                    <div className="text-[11px] text-slate-400">MODIS</div>
                    <div className="mt-0.5 font-mono-tabular text-lg font-bold text-sky-300">
                      {activeRecord.modisCount !== null ? activeRecord.modisCount : '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-[#081523]/80 p-3">
                    <div className="text-[11px] text-slate-400">VIIRS</div>
                    <div className="mt-0.5 font-mono-tabular text-lg font-bold text-purple-300">
                      {activeRecord.year < 2012 || activeRecord.viirsCount === null
                        ? '—'
                        : activeRecord.viirsCount}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#081523]/80 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">
                      {t('historyPage.totalSum')} ({activeRecord.metricUnit})
                    </span>
                    <span className="font-mono-tabular font-semibold text-white">
                      {activeRecord.rawValue !== null ? activeRecord.rawValue : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">
                      {t('historyPage.normBase')} ({activeRecord.comparableSeriesLabel ?? 'MODIS'} ·{' '}
                      {activeRecord.baselinePeriod ?? '2000–2020'})
                    </span>
                    <span className="font-mono-tabular text-slate-300">
                      {activeRecord.historicalBaseline !== null
                        ? `${activeRecord.historicalBaseline}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">
                      {t('historyPage.anomaly')} ({activeRecord.comparableSeriesLabel ?? 'MODIS'})
                    </span>
                    <span className="font-mono-tabular font-semibold text-amber-300">
                      {activeRecord.anomalyValue !== null
                        ? `${activeRecord.anomalyValue >= 0 ? '+' : ''}${activeRecord.anomalyValue}${
                            activeRecord.anomalyPct !== null
                              ? ` (${activeRecord.anomalyPct >= 0 ? '+' : ''}${activeRecord.anomalyPct.toFixed(0)}%)`
                              : ''
                          }`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">{t('historyPage.totalFrp')}</span>
                    <span className="font-mono-tabular font-semibold text-slate-100">
                      {activeRecord.totalFrpMw !== null
                        ? `${activeRecord.totalFrpMw.toFixed(1)} MW`
                        : '—'}
                    </span>
                  </div>
                </div>

                {activeRecord.completenessNote && (
                  <p className="text-[11px] text-amber-300/90">{activeRecord.completenessNote}</p>
                )}

                <div>
                  <button
                    type="button"
                    onClick={() => setExplainOpen((prev) => !prev)}
                    aria-expanded={explainOpen}
                    data-testid="explain-anomaly-btn"
                    className="flex w-full items-center justify-between rounded-xl border border-emerald-400/45 bg-emerald-950/35 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-900/50"
                  >
                    <span className="flex items-center gap-2">
                      <FileSearch className="h-3.5 w-3.5 text-[#6ee755]" aria-hidden="true" />
                      <span>{t('historyPage.explainAnomaly')}</span>
                    </span>
                    {explainOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <span className="text-[10px] text-emerald-300/80">{t('historyPage.5points')}</span>
                    )}
                  </button>

                  {explainOpen && explanation && (
                    <div
                      data-testid="anomaly-explanation-panel"
                      className="mt-2.5 space-y-2 rounded-xl border border-slate-800 bg-[#060f1b]/95 p-3 text-[11px] leading-relaxed text-slate-300"
                    >
                      <div>
                        <span className="font-semibold text-white">1. What happened: </span>
                        {explanation.whatHappened}
                      </div>
                      <div>
                        <span className="font-semibold text-white">2. Deviation from norm: </span>
                        {explanation.deviationFromNorm}
                      </div>
                      <div>
                        <span className="font-semibold text-white">3. Sensors: </span>
                        {explanation.sensorsUsed}
                      </div>
                      <div>
                        <span className="font-semibold text-white">4. Reliability: </span>
                        {explanation.reliability}
                      </div>
                      <div className="border-t border-slate-800 pt-1.5 text-amber-200/90">
                        <span className="font-semibold text-amber-200">5. Limitations: </span>
                        {explanation.limitations}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 text-xs text-slate-400">No observations for selected period.</div>
            )}
          </div>

          {activeRecord && (
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'JUMP_TO_PERIOD_ON_MAP',
                    year: activeRecord.year,
                    week: activeRecord.week,
                    filterByWeek: true,
                  })
                }
                data-testid="history-to-map-btn"
                className="firelens-cta flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold"
              >
                <span>
                  {t('historyPage.jumpToMap', { year: activeRecord.year, week: activeRecord.week })}
                </span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'GO_TO_EVIDENCE_STEP', tab: 'analysis', filterByWeek: false })
                  }
                  className="rounded-xl border border-slate-700/80 bg-[#081523]/80 py-2 text-[11px] font-medium text-slate-200 hover:border-emerald-400/50 hover:text-white"
                >
                  {t('historyPage.rawEvidence')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'GO_TO_EVIDENCE_STEP', tab: 'comparison', filterByWeek: false })
                  }
                  className="rounded-xl border border-slate-700/80 bg-[#081523]/80 py-2 text-[11px] font-medium text-slate-200 hover:border-emerald-400/50 hover:text-white"
                >
                  {t('historyPage.harmonizationEvidence')}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
