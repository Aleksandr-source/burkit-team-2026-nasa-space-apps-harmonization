import { useMemo } from 'react';
import type { EChartsOption, ECElementEvent } from 'echarts';
import type { AnnualObservationPoint, SatelliteSensor } from '../../types/firelens';
import { EChartWrapper } from './EChartWrapper';

interface DynamicsChartProps {
  annualSeries: AnnualObservationPoint[];
  enabledSensors: Record<SatelliteSensor, boolean>;
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

export function DynamicsChart({
  annualSeries,
  enabledSensors,
  selectedYear,
  onSelectYear,
}: DynamicsChartProps) {
  const option: EChartsOption = useMemo(() => {
    const years = annualSeries.map((d) => String(d.year));
    const modisData = annualSeries.map((d) => (enabledSensors.MODIS ? d.modisCount : null));
    const viirsData = annualSeries.map((d) => (enabledSensors.VIIRS ? d.viirsCount : null));
    const selectedIdx = annualSeries.findIndex((d) => d.year === selectedYear);

    const selectedModis =
      selectedIdx >= 0 && enabledSensors.MODIS ? annualSeries[selectedIdx]?.modisCount : null;
    const selectedViirs =
      selectedIdx >= 0 && enabledSensors.VIIRS ? annualSeries[selectedIdx]?.viirsCount : null;

    const highlightPoints: { name: string; coord: [number, number]; itemStyle: { color: string } }[] = [];
    if (selectedIdx >= 0 && selectedModis !== null && selectedModis !== undefined) {
      highlightPoints.push({ name: 'MODIS', coord: [selectedIdx, selectedModis], itemStyle: { color: '#38bdf8' } });
    }
    if (selectedIdx >= 0 && selectedViirs !== null && selectedViirs !== undefined) {
      highlightPoints.push({ name: 'VIIRS', coord: [selectedIdx, selectedViirs], itemStyle: { color: '#c084fc' } });
    }

    return {
      backgroundColor: 'transparent',
      animationDuration: 300,
      grid: { top: 18, right: 12, bottom: 24, left: 38 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8, 17, 29, 0.96)',
        borderColor: 'rgba(74, 222, 128, 0.35)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: unknown) => {
          const items = Array.isArray(params)
            ? (params as { seriesName: string; value: number | null; axisValue: string; color: string }[])
            : [];
          if (items.length === 0) return '';
          const yr = Number(items[0]?.axisValue);
          const row = annualSeries.find((r) => r.year === yr);
          const unit = row?.metricUnit ?? 'набл./год';
          const statusNote =
            row?.completenessStatus === 'partial'
              ? '<div style="color:#fbbf24;font-size:10px;margin-top:4px;">Неполный год</div>'
              : '';
          const lines = items.map((it) => {
            const valStr =
              it.value !== null && it.value !== undefined
                ? `${it.value} ${unit}`
                : it.seriesName === 'VIIRS' && yr < 2012
                  ? 'нет данных (до 2012)'
                  : '—';
            return `<div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:${it.color}">● ${it.seriesName}</span><strong style="font-family:var(--font-mono)">${valStr}</strong></div>`;
          });
          return `<div style="font-weight:600;margin-bottom:4px;">${yr}</div>${lines.join('')}${statusNote}`;
        },
      },
      xAxis: {
        type: 'category',
        data: years,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
        axisLabel: { color: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      series: [
        {
          name: 'MODIS',
          type: 'line',
          smooth: 0.25,
          showSymbol: false,
          data: modisData,
          lineStyle: { color: '#0ea5e9', width: 2 },
          itemStyle: { color: '#38bdf8' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(14, 165, 233, 0.26)' },
                { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
              ],
            },
          },
          markLine:
            selectedIdx >= 0
              ? {
                  symbol: 'none',
                  silent: true,
                  lineStyle: { color: 'rgba(116, 240, 77, 0.55)', type: 'dashed', width: 1.5 },
                  label: {
                    show: true,
                    formatter: String(selectedYear),
                    color: '#74f04d',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  },
                  data: [{ xAxis: selectedIdx }],
                }
              : undefined,
          markPoint:
            highlightPoints.length > 0
              ? {
                  symbol: 'circle',
                  symbolSize: 8,
                  label: { show: false },
                  data: highlightPoints,
                }
              : undefined,
        },
        {
          name: 'VIIRS',
          type: 'line',
          smooth: 0.25,
          showSymbol: false,
          data: viirsData,
          lineStyle: { color: '#a855f7', width: 2.2 },
          itemStyle: { color: '#c084fc' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(168, 85, 247, 0.22)' },
                { offset: 1, color: 'rgba(168, 85, 247, 0.02)' },
              ],
            },
          },
        },
      ],
    };
  }, [annualSeries, enabledSensors.MODIS, enabledSensors.VIIRS, selectedYear]);

  const handleChartClick = (params: ECElementEvent) => {
    const clickedYear = Number(params.name);
    if (!Number.isNaN(clickedYear)) {
      onSelectYear(clickedYear);
    }
  };

  if (annualSeries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        Нет наблюдений за выбранный период
      </div>
    );
  }

  return (
    <EChartWrapper
      option={option}
      onChartClick={handleChartClick}
      ariaLabel="График динамики наблюдений MODIS и VIIRS"
      testId="dynamics-echart"
    />
  );
}
