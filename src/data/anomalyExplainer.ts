import type {
  DataMode,
  HarmonizationResult,
  RegionDefinition,
  SatelliteSensor,
  WeeklyActivityPoint,
} from '../types/firelens';

export interface AnomalyExplanation {
  whatHappened: string;
  deviationFromNorm: string;
  sensorsUsed: string;
  reliability: string;
  limitations: string;
  canDrawFullConclusion: boolean;
}

/**
 * Builds a deterministic, strictly structured 5-part scientific explanation
 * for a selected week in the activity calendar. Never uses generative AI,
 * never claims confirmed wildfire causes, and flags incomplete/unharmonized data.
 */
export function buildAnomalyExplanation(params: {
  region: RegionDefinition;
  record: WeeklyActivityPoint;
  harmonization: HarmonizationResult | null;
  enabledSensors: Record<SatelliteSensor, boolean>;
  dataMode: DataMode;
  language?: 'en' | 'ru';
}): AnomalyExplanation {
  const { region, record, harmonization, enabledSensors, dataMode } = params;
  if(params.language==='en') return {
    whatHappened:record.completenessStatus==='missing'?`${record.year} W${record.week}, ${region.name}: no observations. Missing data is not zero fire activity.`:`${record.year} W${record.week}, ${region.name}: ${record.rawValue ?? 'unknown'} detections; summed FRP ${record.totalFrpMw?.toFixed(1) ?? 'unknown'} MW. Thermal detections do not establish ground causes.`,
    deviationFromNorm:record.historicalBaseline===null||record.anomalyValue===null?'No historical baseline is available.':`Comparable-series anomaly: ${record.anomalyValue}; baseline: ${record.historicalBaseline}. ${dataMode==='demo'?'Synthetic DEMO values.':''}`,
    sensorsUsed:`Enabled sensors: ${Object.entries(enabledSensors).filter(([,v])=>v).map(([k])=>k).join(', ')||'none'}. MODIS and VIIRS have different resolution and confidence scales.`,
    reliability:`${dataMode==='demo'?'Synthetic DEMO':'Imported observations'}; coverage: ${record.completenessStatus}. No independent scientific validation is established.`,
    limitations:'No cloud or overpass correction. These observations do not determine burned area, wildfire causes or operational risk. Exploratory FRP calibration is separate from the historic series.',
    canDrawFullConclusion:false,
  };
  const isDemo = dataMode === 'demo';
  const isHarmonizedVerified = Boolean(harmonization?.verified);

  // 1. Что произошло?
  let whatHappened: string;
  if (record.completenessStatus === 'missing') {
    whatHappened = `За ${record.year} г., неделю W${record.week} в регионе «${region.name}» спутниковые наблюдения отсутствуют (${record.completenessNote ?? 'пропуск архива или будущий период'}). Отсутствие данных нельзя интерпретировать как отсутствие пожаров.`;
  } else {
    const val = record.rawValue ?? 0;
    const frpStr =
      record.totalFrpMw !== null ? `, суммарная мощность излучения FRP: ${record.totalFrpMw.toFixed(1)} МВт` : '';
    whatHappened = `В регионе «${region.name}» за ${record.year} г., неделю W${record.week} зафиксировано ${val} ${record.metricUnit} тепловых детекций${frpStr}. Спутниковые данные подтверждают только тепловые аномалии, без независимой верификации наземных причин.`;
  }

  // 2. Насколько показатель отличается от исторической нормы?
  let deviationFromNorm: string;
  if (record.completenessStatus === 'missing') {
    deviationFromNorm = 'Невозможно рассчитать отклонение: отсутствуют наблюдения за выбранную неделю.';
  } else if (record.historicalBaseline === null || record.anomalyValue === null) {
    deviationFromNorm =
      'Историческая норма не задана в текущем наборе данных — сравнение с базовым периодом невозможно.';
  } else {
    const sign = record.anomalyValue >= 0 ? '+' : '';
    const pctPart =
      record.anomalyPct !== null
        ? ` (${record.anomalyPct >= 0 ? '+' : ''}${record.anomalyPct.toFixed(1)}%)`
        : '';
    const direction =
      record.anomalyValue > 0
        ? 'выше исторической нормы'
        : record.anomalyValue < 0
          ? 'ниже исторической нормы'
          : 'на уровне исторической нормы';
    deviationFromNorm = `По сопоставимому ряду (${record.comparableSeriesLabel ?? 'MODIS'}) отклонение составляет ${sign}${record.anomalyValue} ${record.metricUnit}${pctPart} — ${direction} (норма ${record.historicalBaseline} ${record.metricUnit}, база: ${record.baselinePeriod ?? 'не указана'}).`;
  }

  // 3. Какие сенсоры использовались?
  const usedParts: string[] = [];
  if (enabledSensors.MODIS && record.modisCount !== null) {
    usedParts.push(`MODIS (~1000 м): ${record.modisCount} набл.`);
  } else if (!enabledSensors.MODIS) {
    usedParts.push('MODIS отключён фильтром');
  }

  if (record.year < 2012) {
    usedParts.push('VIIRS не использовался (наблюдения доступны с 2012 г.)');
  } else if (enabledSensors.VIIRS && record.viirsCount !== null) {
    usedParts.push(`VIIRS (~375 м): ${record.viirsCount} набл.`);
  } else if (!enabledSensors.VIIRS) {
    usedParts.push('VIIRS отключён фильтром');
  }
  const sensorsUsed =
    usedParts.length > 0
      ? usedParts.join('; ').replace(/\.$/, '') + '.'
      : 'Нет активных сенсоров.';

  // 4. Насколько надёжен результат?
  const completenessText =
    record.completenessStatus === 'complete'
      ? 'Покрытие недели: полное.'
      : record.completenessStatus === 'partial'
        ? `Покрытие недели: неполное (${record.completenessNote ?? 'возможны пропуски пролётов'}).`
        : 'Покрытие недели: данные отсутствуют.';

  const harmText = isHarmonizedVerified
    ? `Межсенсорная гармонизация подтверждена (${harmonization?.methodName ?? 'Python'}${harmonization?.methodVersion ? ` v${harmonization.methodVersion}` : ''}).`
    : 'Межсенсорная гармонизация MODIS/VIIRS не выполнена — полноценный межгодовой вывод ограничен.';

  const modeText = isDemo ? 'Статус: DEMO-данные (для проверки интерфейса).' : 'Статус: загруженные данные.';
  const reliability = `${completenessText} ${harmText} ${modeText}`;

  // 5. Какие ограничения у этого вывода?
  const limitItems: string[] = [
    'Тепловые аномалии MODIS/VIIRS не подтверждают причину возгорания или площадь выгорания без наземной/оптической верификации.',
    'Облачность и время пролёта спутника могут приводить к пропуску кратковременных очагов.',
  ];
  if (!isHarmonizedVerified) {
    limitItems.push(
      'Без расчёта гармонизации из Python-модуля ряды MODIS (1000 м) и VIIRS (375 м) нельзя напрямую суммировать как однородную величину.'
    );
  }
  if (isDemo) {
    limitItems.push('Текущие значения носят демонстрационный характер (DEMO).');
  }

  const canDrawFullConclusion =
    !isDemo &&
    record.completenessStatus === 'complete' &&
    record.historicalBaseline !== null &&
    isHarmonizedVerified;

  return {
    whatHappened,
    deviationFromNorm,
    sensorsUsed,
    reliability,
    limitations: limitItems.join(' '),
    canDrawFullConclusion,
  };
}
