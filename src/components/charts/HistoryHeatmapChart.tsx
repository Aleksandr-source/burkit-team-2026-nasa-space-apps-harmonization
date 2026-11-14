function escapeHtml(v:unknown):string{return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
import { useMemo } from 'react';
import type { EChartsOption, ECElementEvent } from 'echarts';
import type {
  DataMode,
  HistoryMetricMode,
  WeeklyActivityPoint,
} from '../../types/firelens';
import { EChartWrapper } from './EChartWrapper';

interface HistoryHeatmapChartProps {
  weeklyRows: WeeklyActivityPoint[];
  years: number[];
  metricMode: HistoryMetricMode;
  selectedYear: number;
  selectedWeek: number;
  dataMode: DataMode;
  onSelectCell: (year: number, week: number) => void;
}

export function HistoryHeatmapChart({
  weeklyRows,
  years,
  metricMode,
  selectedYear,
  selectedWeek,
  dataMode,
  onSelectCell,
}: HistoryHeatmapChartProps) {
  const option: EChartsOption = useMemo(() => {
    const weeks = Array.from({ length: 52 }, (_, i) => `W${i + 1}`);
    const yearLabels = years.map(String);

    const rowByKey = new Map<string, WeeklyActivityPoint>();
    for (const r of weeklyRows) {
      rowByKey.set(`${r.year}-${r.week}`, r);
    }

    const observedValues: number[] = [];
    const data: {
      value: [number, number, number | null];
      itemStyle?: { borderColor?: string; borderWidth?: number; color?: string };
    }[] = [];

    for (const row of weeklyRows) {
      const yIdx = years.indexOf(row.year);
      if (yIdx < 0) continue;

      const isMissing = row.completenessStatus === 'missing';
      const val = isMissing
        ? null
        : metricMode === 'raw'
          ? row.rawValue
          : metricMode === 'harmonized'
            ? row.harmonizedValue
            : row.anomalyValue;

      if (val !== null && val !== undefined) {
        observedValues.push(val);
      }

      const isSelected = row.year === selectedYear && row.week === selectedWeek;
      const isPartial = row.completenessStatus === 'partial';
      const hasNoValue = isMissing || val === null || val === undefined;

      data.push({
        value: [row.week - 1, yIdx, hasNoValue ? null : val],
        itemStyle: hasNoValue
          ? {
              color: '#070d16',
              borderColor: isSelected ? '#74f04d' : 'rgba(100, 116, 139, 0.35)',
              borderWidth: isSelected ? 2 : 1,
            }
          : isSelected
            ? {
                borderColor: '#74f04d',
                borderWidth: 2,
              }
            : isPartial
              ? {
                  borderColor: 'rgba(251, 191, 36, 0.65)',
                  borderWidth: 1.2,
                }
              : undefined,
      });
    }

    const maxAbsAnomaly = Math.max(
      15,
      ...(observedValues.length ? observedValues.map((v) => Math.abs(v)) : [25])
    );
    const minVal = metricMode === 'anomaly' ? -maxAbsAnomaly : 0;
    const maxVal =
      metricMode === 'anomaly'
        ? maxAbsAnomaly
        : Math.max(10, ...(observedValues.length ? observedValues : [50]));

    const modeTitle =
      metricMode === 'raw'
        ? 'Исходная активность'
        : metricMode === 'harmonized'
          ? 'Гармонизированная активность'
          : 'Аномалия к норме';

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: 'rgba(8, 17, 29, 0.96)',
        borderColor: 'rgba(74, 222, 128, 0.45)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { value: [number, number, number | null] };
          const w = p.value[0] + 1;
          const yr = years[p.value[1]];
          const row = rowByKey.get(`${yr}-${w}`);
          const statusLabel = dataMode === 'demo' ? 'DEMO (демо-данные)' : 'Реальные данные';

          if (!row || row.completenessStatus === 'missing') {
            return `<strong>${yr} · W${w}</strong><br/><span style="color:#94a3b8">Нет спутниковых наблюдений</span><br/><span style="color:#fbbf24;font-size:10px">${statusLabel}</span>`;
          }

          if (metricMode === 'harmonized' && row.harmonizedValue === null) {
            return `<strong>${yr} · Неделя W${w}</strong><br/><span style="color:#fbbf24">Гармонизация ожидает научной обработки</span><div style="color:#94a3b8;font-size:10px;margin-top:3px">${statusLabel}</div>`;
          }

          const valStr =
            metricMode === 'raw'
              ? `${row.rawValue ?? 'Нет данных'} ${escapeHtml(row.metricUnit)}`
              : metricMode === 'harmonized'
                ? `${row.harmonizedValue ?? 'Нет данных'} ${escapeHtml(row.metricUnit)}`
                : `${row.anomalyValue !== null ? (row.anomalyValue >= 0 ? `+${row.anomalyValue}` : row.anomalyValue) : 'Нет данных'} ${escapeHtml(row.metricUnit)}`;

          const anomalyMeta =
            metricMode === 'anomaly' && row.comparableSeriesLabel
              ? `<div style="color:#94a3b8;font-size:10px;margin-top:2px">Ряд: ${escapeHtml(row.comparableSeriesLabel)} · База: ${escapeHtml(row.baselinePeriod ?? '—')}</div>`
              : '';

          const completenessNote =
            row.completenessStatus === 'partial'
              ? '<div style="color:#fbbf24;font-size:10px;margin-top:2px">Неполная неделя</div>'
              : '';

          return `<strong>${yr} · Неделя W${w}</strong><br/>${modeTitle}: <strong style="color:#fbbf24">${valStr}</strong>${anomalyMeta}${completenessNote}<div style="color:#94a3b8;font-size:10px;margin-top:3px">${statusLabel}</div>`;
        },
      },
      grid: { top: 14, right: 20, bottom: 54, left: 48 },
      xAxis: {
        type: 'category',
        data: weeks,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          fontFamily: 'JetBrains Mono',
          interval: 3,
        },
      },
      yAxis: {
        type: 'category',
        data: yearLabels,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        axisLabel: {
          color: (val?: string | number) => (Number(val) === selectedYear ? '#74f04d' : '#cbd5e1'),
          fontSize: 10,
          fontFamily: 'JetBrains Mono',
        },
      },
      visualMap: {
        min: minVal,
        max: maxVal,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemWidth: 12,
        itemHeight: 170,
        text:
          metricMode === 'anomaly'
            ? ['Выше нормы', 'Ниже нормы']
            : ['Высокая', 'Низкая'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        inRange:
          metricMode === 'anomaly'
            ? {
                color: ['#0284c7', '#1e3a5f', '#0f2436', '#f59e0b', '#ef4444'],
              }
            : {
                color: ['#0b1a2a', '#134e3a', '#eab308', '#f97316', '#ef4444'],
              },
      },
      series: [
        {
          name: modeTitle,
          type: 'heatmap',
          data: data as never,
          itemStyle: {
            borderColor: '#040b14',
            borderWidth: 1,
          },
          emphasis: {
            itemStyle: {
              borderColor: '#74f04d',
              borderWidth: 1.5,
            },
          },
        },
      ],
    };
  }, [weeklyRows, years, metricMode, selectedYear, selectedWeek, dataMode]);

  const handleClick = (params: ECElementEvent) => {
    const v = params.value as [number, number, number | null] | undefined;
    if (!Array.isArray(v)) return;
    const week = v[0] + 1;
    const year = years[v[1]];
    if (year) onSelectCell(year, week);
  };

  if (weeklyRows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Нет наблюдений за выбранный период
      </div>
    );
  }

  return (
    <EChartWrapper
      option={option}
      onChartClick={handleClick}
      ariaLabel="Календарь пожарной активности по годам и неделям"
      testId="history-heatmap-echart"
    />
  );
}
