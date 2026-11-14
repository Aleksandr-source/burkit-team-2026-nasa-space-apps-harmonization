import { useEffect, useMemo, useState } from 'react';
import type { EChartsOption, ECElementEvent } from 'echarts';
import type {
  AnnualObservationPoint,
  ComparisonMode,
  SatelliteSensor,
} from '../../types/firelens';
import { EChartWrapper } from './EChartWrapper';

interface ComparisonChartProps {
  annualSeries: AnnualObservationPoint[];
  comparisonMode: ComparisonMode;
  metricUnit: string;
  selectedYear: number;
  enabledSensors: Record<SatelliteSensor, boolean>;
  hasHarmonizedSeries: boolean;
  onSelectYear: (year: number) => void;
}

export function ComparisonChart({
  annualSeries,
  comparisonMode,
  metricUnit,
  selectedYear,
  enabledSensors,
  hasHarmonizedSeries,
  onSelectYear,
}: ComparisonChartProps) {
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const onResize = () => {
      setIsCompact(window.innerWidth < 640);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const option: EChartsOption = useMemo(() => {
    const years = annualSeries.map((r) => String(r.year));
    const modisCounts = annualSeries.map((r) => (enabledSensors.MODIS ? r.modisCount : null));
    const viirsCounts = annualSeries.map((r) => (enabledSensors.VIIRS ? r.viirsCount : null));
    const harmonizedCounts = annualSeries.map((r) => r.harmonizedCount);
    const hasCi = annualSeries.some(
      (r) => r.harmonizedLowerCi != null && r.harmonizedUpperCi != null
    );
    const selectedIdx = annualSeries.findIndex((r) => r.year === selectedYear);

    const idx2011 = annualSeries.findIndex((r) => r.year === 2011);
    const idx2012 = annualSeries.findIndex((r) => r.year === 2012);
    const lastIdx = annualSeries.length - 1;

    const markAreas: [[{ xAxis: number; name?: string; itemStyle?: object }, { xAxis: number }]] | unknown[] = [];
    if (idx2011 >= 0) {
      markAreas.push([
        {
          name: isCompact ? 'Только MODIS' : 'Только MODIS (до 2012)',
          xAxis: 0,
          itemStyle: { color: 'rgba(14, 165, 233, 0.06)' },
        },
        { xAxis: idx2011 },
      ]);
    }
    if (idx2012 >= 0 && lastIdx >= idx2012) {
      markAreas.push([
        {
          name: isCompact ? 'MODIS + VIIRS' : 'Перекрытие MODIS + VIIRS',
          xAxis: idx2012,
          itemStyle: { color: 'rgba(74, 222, 128, 0.06)' },
        },
        { xAxis: lastIdx },
      ]);
    }

    const series: EChartsOption['series'] = [
      {
        name: 'MODIS (исх.)',
        type: 'line',
        smooth: 0.25,
        data: modisCounts,
        lineStyle: { color: '#0ea5e9', width: 2.2 },
        itemStyle: { color: '#38bdf8' },
        markArea:
          markAreas.length > 0
            ? {
                silent: true,
                label: {
                  color: '#94a3b8',
                  fontSize: isCompact ? 9 : 10,
                  position: 'insideTop',
                  distance: 6,
                },
                data: markAreas as never,
              }
            : undefined,
        markLine:
          selectedIdx >= 0
            ? {
                symbol: 'none',
                silent: true,
                lineStyle: { color: 'rgba(116, 240, 77, 0.65)', type: 'dashed', width: 1.5 },
                label: {
                  formatter: String(selectedYear),
                  color: '#74f04d',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 10,
                },
                data: [{ xAxis: selectedIdx }],
              }
            : undefined,
      },
      {
        name: 'VIIRS (исх.)',
        type: 'line',
        smooth: 0.25,
        data: viirsCounts,
        lineStyle: { color: '#a855f7', width: 2.2 },
        itemStyle: { color: '#c084fc' },
      },
    ];

    if (comparisonMode === 'harmonized' && hasHarmonizedSeries) {
      if (hasCi) {
        const lowerData = annualSeries.map((r) => r.harmonizedLowerCi ?? null);
        const bandWidth = annualSeries.map((r) =>
          r.harmonizedUpperCi != null && r.harmonizedLowerCi != null
            ? Number((r.harmonizedUpperCi - r.harmonizedLowerCi).toFixed(2))
            : null
        );
        series.push(
          {
            name: 'ДИ (нижн.)',
            type: 'line',
            stack: 'ci-band',
            symbol: 'none',
            lineStyle: { opacity: 0 },
            data: lowerData,
            silent: true,
          },
          {
            name: 'Неопределённость (95% ДИ)',
            type: 'line',
            stack: 'ci-band',
            symbol: 'none',
            lineStyle: { opacity: 0 },
            areaStyle: { color: 'rgba(101, 232, 70, 0.16)' },
            data: bandWidth,
          }
        );
      }

      series.push({
        name: 'Гармонизированный ряд',
        type: 'line',
        smooth: 0.25,
        data: harmonizedCounts,
        lineStyle: { color: '#65e846', width: 3 },
        itemStyle: { color: '#65e846' },
      });
    }

    const legendItems = ['MODIS (исх.)', 'VIIRS (исх.)'];
    if (comparisonMode === 'harmonized' && hasHarmonizedSeries) {
      if (hasCi) legendItems.push('Неопределённость (95% ДИ)');
      legendItems.push('Гармонизированный ряд');
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8, 17, 29, 0.96)',
        borderColor: 'rgba(74, 222, 128, 0.35)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        valueFormatter: (val) => (val === null || val === undefined ? 'нет данных' : `${val} ${metricUnit}`),
      },
      legend: {
        top: 0,
        right: 0,
        data: legendItems,
        itemWidth: isCompact ? 14 : 20,
        textStyle: { color: '#cbd5e1', fontSize: isCompact ? 10 : 11 },
      },
      grid: {
        top: isCompact ? (comparisonMode === 'harmonized' ? 66 : 52) : 44,
        right: 12,
        bottom: 28,
        left: isCompact ? 40 : 48,
      },
      xAxis: {
        type: 'category',
        data: years,
        axisLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.25)' } },
        axisLabel: { color: '#94a3b8', fontSize: isCompact ? 10 : 11, fontFamily: 'JetBrains Mono' },
      },
      yAxis: {
        type: 'value',
        name: metricUnit,
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
        axisLabel: { color: '#94a3b8', fontSize: isCompact ? 10 : 11, fontFamily: 'JetBrains Mono' },
      },
      series,
    };
  }, [
    annualSeries,
    comparisonMode,
    metricUnit,
    selectedYear,
    enabledSensors.MODIS,
    enabledSensors.VIIRS,
    hasHarmonizedSeries,
    isCompact,
  ]);

  const handleClick = (params: ECElementEvent) => {
    const yr = Number(params.name);
    if (!Number.isNaN(yr)) onSelectYear(yr);
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
      onChartClick={handleClick}
      ariaLabel="График сравнения спутниковых наблюдений MODIS и VIIRS"
      testId="comparison-echart"
    />
  );
}
