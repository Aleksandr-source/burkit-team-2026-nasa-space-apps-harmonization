import { useFireLens } from '../../state/FireLensContext';
import { chartText } from '../../i18n/chartText';
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption, ECElementEvent } from 'echarts';

interface EChartWrapperProps {
  option: EChartsOption;
  className?: string;
  onChartClick?: (params: ECElementEvent) => void;
  ariaLabel?: string;
  testId?: string;
}

export function EChartWrapper({
  option,
  className = 'w-full h-full',
  onChartClick,
  ariaLabel,
  testId,
}: EChartWrapperProps) {
  const {state} = useFireLens();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const clickHandlerRef = useRef(onChartClick);
  clickHandlerRef.current = onChartClick;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: 'canvas' });
    instanceRef.current = chart;

    const handleClick = (params: ECElementEvent) => {
      clickHandlerRef.current?.(params);
    };
    chart.on('click', handleClick);

    const observer = new ResizeObserver(() => {
      chart.resize();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.off('click', handleClick);
      chart.dispose();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = instanceRef.current;
    if (!chart) return;
    const transform=(v:any,key=''):any=>{
      if(typeof v==='function')return (...args:any[])=>{const out=v(...args);return typeof out==='string'?chartText(out,state.language):out;};
      if(typeof v==='string'){
        if(state.siteTheme==='light' && ['color','backgroundColor','borderColor'].includes(key)) {
          if(key==='backgroundColor' && ['#fff','#ffffff','#f8fafc'].includes(v))return '#ffffff';
          if(key==='backgroundColor' && v.startsWith('rgba(8, 17, 29'))return '#ffffff';
          if(['#94a3b8','#cbd5e1','#e2e8f0','#f8fafc','#fff','#ffffff'].includes(v))return '#334155';
          if(v.startsWith('rgba(15, 23, 42'))return '#ffffff';
        }
        return chartText(v,state.language);
      }
      if(Array.isArray(v))return v.map(x=>transform(x,key));
      if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,transform(x,k)]));return v;
    };
    chart.setOption(transform(option), { notMerge: true, lazyUpdate: true });
  }, [option,state.language,state.siteTheme]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
    />
  );
}
