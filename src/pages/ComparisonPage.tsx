import { useMemo } from 'react';
import { Info, Upload, Layers, Lock, HelpCircle } from 'lucide-react';
import { useFireLens } from '../state/FireLensContext';
import { ComparisonChart } from '../components/charts/ComparisonChart';
import type { InfoTopic } from '../components/InfoModal';

interface ComparisonPageProps {
  onOpenInfo: (topic: InfoTopic) => void;
}

export function ComparisonPage({ onOpenInfo }: ComparisonPageProps) {
  const {
    state,
    selectedRegion,
    activeRegionData,
    filteredAnnualSeries,
    dispatch,
    uploadJsonFile,
    t,
  } = useFireLens();

  const harmonization = activeRegionData?.harmonization ?? null;
  const isVerified = Boolean(harmonization?.verified);

  const hasHarmonizedSeries = useMemo(
    () => filteredAnnualSeries.some((row) => row.harmonizedCount !== null),
    [filteredAnnualSeries]
  );
  const canShowHarmonized = isVerified && hasHarmonizedSeries;
  const effectiveMode =
    state.comparisonMode === 'harmonized' && !canShowHarmonized ? 'raw' : state.comparisonMode;

  const metricName =
    harmonization?.metricName ??
    filteredAnnualSeries[0]?.metricName ??
    'Thermal Anomaly Count';
  const metricUnit =
    harmonization?.metricUnit ?? filteredAnnualSeries[0]?.metricUnit ?? 'obs./yr';

  const validation = harmonization?.validation;
  const limitations =
    harmonization?.limitations && harmonization.limitations.length > 0
      ? harmonization.limitations
      : state.dataset.provenance.limitations;
  const isDemo = state.dataMode === 'demo';

  return (
    <div className="space-y-4">
      <section className="firelens-panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-950/60 text-emerald-300">
            <Layers className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-bold text-white">
                {t('comparisonPage.title')}
              </h1>
              <button
                type="button"
                onClick={() => onOpenInfo('harmonization-methodology')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:border-emerald-400/60"
              >
                <HelpCircle className="h-3 w-3" aria-hidden="true" />
                <span>{t('comparisonPage.howItWorks')}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenInfo('comparison')}
                aria-label="Info comparison"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 text-slate-300 hover:border-emerald-400/60 hover:text-white"
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              {selectedRegion.name} · {t('mapPage.yearLabel')}{' '}
              <span className="font-mono-tabular text-emerald-300">
                {state.selectedYear} · W{state.selectedWeek}
              </span>{' '}
              · Metric: {metricName} ({metricUnit}) ·{' '}
              {isDemo ? t('demoData') : state.dataset.sourceName}
            </p>
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
                onClick={() => dispatch({ type: 'GO_TO_EVIDENCE_STEP', tab: 'analysis' })}
                className="rounded-lg border border-slate-700/80 bg-[#081523]/80 px-2.5 py-1 text-slate-300 hover:border-emerald-400/50 hover:text-white"
              >
                {t('tabs.analysis')}
              </button>
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label="Comparison mode"
          className="inline-flex rounded-xl border border-slate-700/80 bg-[#060f1b] p-1 self-start sm:self-auto"
        >
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_COMPARISON_MODE', mode: 'raw' })}
            aria-pressed={effectiveMode === 'raw'}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              effectiveMode === 'raw'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-400/60'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {t('comparisonPage.modeRaw')}
          </button>
          <button
            type="button"
            disabled={!canShowHarmonized}
            aria-disabled={!canShowHarmonized}
            onClick={() => dispatch({ type: 'SET_COMPARISON_MODE', mode: 'harmonized' })}
            aria-pressed={effectiveMode === 'harmonized'}
            title={!canShowHarmonized ? t('comparisonPage.lockedTooltip') : undefined}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              !canShowHarmonized
                ? 'cursor-not-allowed text-slate-600 border border-transparent opacity-70'
                : effectiveMode === 'harmonized'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-400/60'
                  : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {!canShowHarmonized && <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />}
            <span>{t('comparisonPage.modeHarmonized')}</span>
          </button>
        </div>
      </section>

      <section className="firelens-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Comparison MODIS & VIIRS ({effectiveMode === 'raw' ? 'raw series' : 'harmonized'})
            </h2>
            <p className="text-xs text-slate-400">
              Unit: {metricUnit} · Selected year:{' '}
              <span className="font-mono-tabular text-emerald-300">{state.selectedYear}</span>
            </p>
          </div>

          {!canShowHarmonized && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-900/60">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('comparisonPage.uploadHarmJson')}</span>
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
          )}
        </div>

        {!canShowHarmonized && (
          <div
            data-testid="harmonization-pending-banner"
            className="mt-3 flex items-start gap-2.5 rounded-xl border border-slate-700/80 bg-[#081523]/75 px-3.5 py-2.5 text-xs text-slate-300"
          >
            <Lock className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
            <span>{t('comparisonPage.lockedBanner')}</span>
          </div>
        )}

        <div className="mt-4 h-76 w-full">
          <ComparisonChart
            annualSeries={filteredAnnualSeries}
            comparisonMode={effectiveMode}
            metricUnit={metricUnit}
            selectedYear={state.selectedYear}
            enabledSensors={state.enabledSensors}
            hasHarmonizedSeries={hasHarmonizedSeries}
            onSelectYear={(year) => dispatch({ type: 'SET_YEAR', year })}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="firelens-panel rounded-2xl p-4 sm:p-5">
          <h2 className="font-display text-base font-semibold text-white">
            {t('comparisonPage.tableTitle')}
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Parameter</th>
                  <th className="py-2 pr-3 font-medium text-sky-300">MODIS</th>
                  <th className="py-2 font-medium text-purple-300">VIIRS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                <tr>
                  <td className="py-2.5 pr-3 text-slate-400">{t('comparisonPage.pixelRes')}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular">1000m (nadir)</td>
                  <td className="py-2.5 font-mono-tabular">375m (I-band)</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 text-slate-400">{t('comparisonPage.archive')}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular">2000 – 2026</td>
                  <td className="py-2.5 font-mono-tabular">2012 – 2026 (absent before 2012)</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 text-slate-400">{t('comparisonPage.overlapPeriod')}</td>
                  <td colSpan={2} className="py-2.5 font-mono-tabular text-emerald-300">
                    {harmonization?.overlapPeriod
                      ? `${harmonization.overlapPeriod[0]} – ${harmonization.overlapPeriod[1]}`
                      : '2012 – 2026 (15 years overlap)'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 text-slate-400">{t('comparisonPage.calibPeriod')}</td>
                  <td colSpan={2} className="py-2.5 font-mono-tabular text-slate-200">
                    {isVerified && harmonization?.calibrationPeriod
                      ? `${harmonization.calibrationPeriod[0]} – ${harmonization.calibrationPeriod[1]}`
                      : 'Awaiting Python module'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-3 text-slate-400">{t('comparisonPage.beforeAfter')}</td>
                  <td colSpan={2} className="py-2.5 font-mono-tabular text-slate-200">
                    {isVerified && harmonization?.beforeValue != null && harmonization?.afterValue != null
                      ? `${harmonization.beforeValue} → ${harmonization.afterValue} ${metricUnit}`
                      : 'No verified calculation'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="firelens-panel rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-white">
              {t('comparisonPage.errorTitle')}
            </h2>
            <span className="text-[11px] text-slate-400">
              {isVerified && harmonization
                ? `${harmonization.methodName}${harmonization.methodVersion ? ` v${harmonization.methodVersion}` : ''}`
                : 'Awaiting scientific processing'}
            </span>
          </div>

          {isVerified && (validation?.holdoutPeriod || validation?.holdoutSampleSize != null) && (
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-emerald-300/90">
              {validation?.holdoutPeriod && (
                <span>Holdout period: {validation.holdoutPeriod}</span>
              )}
              {validation?.holdoutSampleSize != null && (
                <span className="font-mono-tabular">Sample size: n = {validation.holdoutSampleSize}</span>
              )}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              {
                label: `MAE${validation?.unit ? ` (${validation.unit})` : ''}`,
                value: isVerified ? validation?.mae : null,
              },
              {
                label: `RMSE${validation?.unit ? ` (${validation.unit})` : ''}`,
                value: isVerified ? validation?.rmse : null,
              },
              {
                label: `Bias${validation?.unit ? ` (${validation.unit})` : ''}`,
                value: isVerified ? validation?.bias : null,
              },
              {
                label: 'R²',
                value: isVerified ? validation?.rSquared : null,
              },
              {
                label: '95% Uncertainty CI',
                value: isVerified ? validation?.confidenceInterval95 : null,
                wide: true,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className={`rounded-xl border border-slate-800 bg-[#081523]/80 p-3 ${
                  metric.wide ? 'col-span-2 sm:col-span-2' : ''
                }`}
              >
                <div className="text-[11px] text-slate-400">{metric.label}</div>
                <div className="mt-1 font-mono-tabular text-base font-bold text-slate-100">
                  {metric.value !== null && metric.value !== undefined ? metric.value : '—'}
                </div>
              </div>
            ))}
          </div>

          {limitations.length > 0 && (
            <p className="mt-3 border-t border-slate-800/80 pt-2.5 text-[11px] leading-relaxed text-amber-200/85">
              Limitations: {limitations[0]}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
