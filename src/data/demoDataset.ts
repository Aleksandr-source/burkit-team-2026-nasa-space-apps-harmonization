import type {
  FireLensDataset,
  HotspotObservation,
  AnnualObservationPoint,
  WeeklyActivityPoint,
  RegionDefinition,
  RegionDataset,
  ViirsConfidenceLevel,
} from '../types/firelens';
import { isPointInRegionLand } from '../map/realGeoBoundaries';

export const DEMO_REGIONS: RegionDefinition[] = [
  {
    id: 'kazakhstan',
    name: 'Казахстан',
    isoNumeric: '398',
    boundaryType: 'verified_geojson',
    center: [66.9, 48.0],
    zoom: 4.1,
    bounds: { west: 46.5, south: 40.5, east: 87.3, north: 55.5 },
    labelCoords: [67.0, 48.2],
  },
  {
    id: 'siberia',
    name: 'Сибирь',
    boundaryType: 'study_bbox',
    center: [103.5, 61.0],
    zoom: 3.1,
    bounds: { west: 68.0, south: 51.0, east: 136.0, north: 73.0 },
    labelCoords: [103.5, 61.5],
  },
  {
    id: 'california',
    name: 'Калифорния',
    usStateFips: '06',
    boundaryType: 'verified_geojson',
    center: [-119.5, 37.3],
    zoom: 5.0,
    bounds: { west: -124.5, south: 32.5, east: -114.1, north: 42.0 },
    labelCoords: [-119.6, 37.3],
  },
  {
    id: 'amazon',
    name: 'Амазония',
    boundaryType: 'study_bbox',
    center: [-60.5, -6.2],
    zoom: 3.9,
    bounds: { west: -73.8, south: -14.8, east: -47.2, north: 4.0 },
    labelCoords: [-60.5, -6.2],
  },
  {
    id: 'australia',
    name: 'Австралия (ЮВ)',
    boundaryType: 'study_bbox',
    center: [147.2, -33.8],
    zoom: 4.9,
    bounds: { west: 140.5, south: -39.1, east: 153.8, north: -28.0 },
    labelCoords: [147.2, -33.8],
  },
  {
    id: 'kamchatka',
    name: 'Камчатка (нет записей)',
    boundaryType: 'study_bbox',
    center: [159.5, 55.5],
    zoom: 4.6,
    bounds: { west: 155.5, south: 50.8, east: 163.8, north: 60.8 },
    labelCoords: [159.5, 55.5],
  },
];

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface ClusterAnchor {
  lng: number;
  lat: number;
  spreadLng: number;
  spreadLat: number;
  weight: number;
}

const REGION_CLUSTERS: Record<string, ClusterAnchor[]> = {
  kazakhstan: [
    { lng: 55.2, lat: 47.4, spreadLng: 1.8, spreadLat: 1.1, weight: 0.9 },
    { lng: 69.8, lat: 52.1, spreadLng: 2.3, spreadLat: 1.3, weight: 1.1 },
    { lng: 82.4, lat: 48.4, spreadLng: 1.8, spreadLat: 1.4, weight: 1.3 },
    { lng: 67.2, lat: 43.8, spreadLng: 1.9, spreadLat: 1.0, weight: 1.2 },
    { lng: 77.6, lat: 44.6, spreadLng: 1.6, spreadLat: 1.0, weight: 1.0 },
  ],
  siberia: [
    { lng: 93.5, lat: 58.6, spreadLng: 5.0, spreadLat: 2.4, weight: 1.1 },
    { lng: 112.5, lat: 62.4, spreadLng: 6.5, spreadLat: 2.8, weight: 1.3 },
    { lng: 126.0, lat: 63.2, spreadLng: 5.8, spreadLat: 2.7, weight: 1.4 },
    { lng: 106.5, lat: 54.4, spreadLng: 4.0, spreadLat: 2.0, weight: 0.9 },
  ],
  california: [
    { lng: -121.4, lat: 39.8, spreadLng: 1.1, spreadLat: 1.0, weight: 1.3 },
    { lng: -122.4, lat: 38.4, spreadLng: 0.9, spreadLat: 0.8, weight: 1.1 },
    { lng: -119.1, lat: 36.8, spreadLng: 1.0, spreadLat: 1.0, weight: 1.0 },
    { lng: -117.6, lat: 34.1, spreadLng: 1.0, spreadLat: 0.7, weight: 1.1 },
  ],
  amazon: [
    { lng: -55.2, lat: -6.8, spreadLng: 4.0, spreadLat: 2.3, weight: 1.4 },
    { lng: -62.5, lat: -8.9, spreadLng: 3.6, spreadLat: 2.1, weight: 1.2 },
    { lng: -50.8, lat: -4.1, spreadLng: 2.8, spreadLat: 1.8, weight: 1.1 },
    { lng: -66.8, lat: -5.2, spreadLng: 3.2, spreadLat: 2.2, weight: 0.9 },
  ],
  australia: [
    { lng: 149.8, lat: -33.2, spreadLng: 1.2, spreadLat: 1.4, weight: 1.3 },
    { lng: 147.4, lat: -36.8, spreadLng: 1.4, spreadLat: 1.1, weight: 1.2 },
    { lng: 151.3, lat: -30.6, spreadLng: 1.1, spreadLat: 1.2, weight: 1.1 },
  ],
};

function weekToIsoDate(year: number, week: number, dayOffset: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayW1 = new Date(jan4.getTime() - (day - 1) * 86400000);
  const target = new Date(mondayW1.getTime() + ((week - 1) * 7 + dayOffset) * 86400000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pickViirsConfidence(intensity: number): ViirsConfidenceLevel {
  if (intensity >= 0.72) return 'high';
  if (intensity >= 0.38) return 'nominal';
  return 'low';
}

function generateRegionDemoData(regionId: string, seedOffset: number): RegionDataset {
  if (regionId === 'kamchatka') {
    return {
      regionId,
      annualSeries: [],
      weeklyActivity: [],
      hotspots: [],
      harmonization: null,
    };
  }

  const rng = createRng(202600 + seedOffset * 9173);
  const clusters = REGION_CLUSTERS[regionId] ?? [];
  const annualSeries: AnnualObservationPoint[] = [];
  const weeklyActivity: WeeklyActivityPoint[] = [];
  const hotspots: HotspotObservation[] = [];

  const peakWeeksByRegion: Record<string, [number, number]> = {
    kazakhstan: [24, 38],
    siberia: [23, 35],
    california: [30, 44],
    amazon: [31, 43],
    australia: [46, 8],
  };
  const [peakStart, peakEnd] = peakWeeksByRegion[regionId] ?? [22, 36];
  const peakMid =
    peakStart <= peakEnd
      ? (peakStart + peakEnd) / 2
      : ((peakStart + peakEnd + 52) / 2) % 52 || 52;

  // First pass: generate MODIS & VIIRS weekly observations
  const tempWeekly: {
    year: number;
    week: number;
    wkModis: number | null;
    wkViirs: number | null;
    totalFrpMw: number | null;
    completenessStatus: 'complete' | 'partial' | 'missing';
    completenessNote?: string;
  }[] = [];

  for (let year = 2000; year <= 2026; year++) {
    const isPartialYear = year === 2000 || year === 2026;
    const yearWave =
      1 +
      0.32 * Math.sin((year - 2000) * 0.48 + seedOffset) +
      (year >= 2019 && year <= 2022 ? 0.35 : 0) +
      (year === 2021 ? 0.18 : 0);

    const modisCount = Math.round((isPartialYear ? 0.82 : 1) * (140 * yearWave + rng() * 55));
    const viirsAvailable = year >= 2012;
    const viirsCount = viirsAvailable
      ? Math.round(modisCount * (1.42 + rng() * 0.25))
      : null;

    annualSeries.push({
      year,
      metricName: 'Количество тепловых аномалий',
      metricUnit: 'набл./год',
      modisCount,
      viirsCount,
      harmonizedCount: null,
      harmonizedLowerCi: null,
      harmonizedUpperCi: null,
      modisMeanFrpMw: Number((28 + rng() * 19).toFixed(1)),
      viirsMeanFrpMw: viirsAvailable ? Number((19 + rng() * 14).toFixed(1)) : null,
      harmonizedMeanFrpMw: null,
      completenessStatus: isPartialYear ? 'partial' : 'complete',
      completenessNote:
        year === 2000
          ? 'MODIS Terra начал регулярные наблюдения с конца февраля 2000 г.'
          : year === 2026
            ? 'Неполный год (текущая дата 2026-11-13 — недели W47–W52 ещё не наступили).'
            : undefined,
    });

    for (let week = 1; week <= 52; week++) {
      // Current date is Nov 13, 2026 (~Week 46). Weeks >= 47 in 2026 have NOT occurred yet!
      const isFuture2026 = year === 2026 && week >= 47;
      const isPreArchive2000 = year === 2000 && week <= 7;
      const isMissing = isFuture2026 || isPreArchive2000;
      const isPartialWeek = (year === 2000 && week === 8) || (year === 2026 && week === 46);

      if (isMissing) {
        tempWeekly.push({
          year,
          week,
          wkModis: null,
          wkViirs: null,
          totalFrpMw: null,
          completenessStatus: 'missing',
          completenessNote: isFuture2026
            ? 'Будущая неделя 2026 года — наблюдения ещё не проводились.'
            : 'Нет спутниковых наблюдений до начала архива MODIS Terra.',
        });
        continue;
      }

      const rawDist = Math.abs(week - peakMid);
      const circularDist = Math.min(rawDist, 52 - rawDist);
      const gaussian = Math.exp(-(circularDist * circularDist) / (2 * 6.5 * 6.5));
      const seasonalFactor = 0.03 + gaussian * (0.72 + rng() * 0.28) + rng() * 0.06;
      const intensity = Math.min(1, Math.max(0.0, seasonalFactor * (0.72 + 0.28 * yearWave)));

      const wkModis = Math.max(0, Math.round(intensity * 22 + rng() * 4 - 1));
      const wkViirs = viirsAvailable
        ? Math.max(0, Math.round(wkModis * (1.35 + rng() * 0.25)))
        : null;

      tempWeekly.push({
        year,
        week,
        wkModis,
        wkViirs,
        totalFrpMw: Number(((wkModis * 26 + (wkViirs ?? 0) * 18) * (0.7 + rng() * 0.6)).toFixed(1)),
        completenessStatus: isPartialWeek ? 'partial' : 'complete',
        completenessNote: isPartialWeek
          ? 'Неполная неделя (текущий период или частичное покрытие орбиты).'
          : undefined,
      });
    }

    const regionBounds = DEMO_REGIONS.find((r) => r.id === regionId)?.bounds;
    const pointsPerYear = Math.round(32 * yearWave);
    for (let i = 0; i < pointsPerYear; i++) {
      const cluster = clusters[i % clusters.length];
      if (!cluster) continue;

      let lng = cluster.lng;
      let lat = cluster.lat;
      let radius = 0.25;
      for (let attempt = 0; attempt < 32; attempt++) {
        const angle = rng() * Math.PI * 2;
        const candidateRadius = Math.pow(rng(), 0.72);
        const candidateLng = Number(
          (cluster.lng + Math.cos(angle) * cluster.spreadLng * candidateRadius).toFixed(4)
        );
        const candidateLat = Number(
          (cluster.lat + Math.sin(angle) * cluster.spreadLat * candidateRadius).toFixed(4)
        );
        if (!regionBounds || isPointInRegionLand(regionId, regionBounds, candidateLng, candidateLat)) {
          lng = candidateLng;
          lat = candidateLat;
          radius = candidateRadius;
          break;
        }
      }

      const isViirs = viirsAvailable && rng() > 0.42;
      const intensity = Number(
        Math.min(
          1,
          Math.max(0.18, (1 - radius * 0.65) * cluster.weight * (0.65 + rng() * 0.45))
        ).toFixed(2)
      );
      const frpMw = Number((12 + intensity * 145 * (isViirs ? 0.85 : 1.1)).toFixed(1));

      let week =
        peakStart <= peakEnd
          ? Math.min(52, Math.max(1, Math.round(peakStart + rng() * (peakEnd - peakStart))))
          : rng() > 0.5
            ? Math.min(52, Math.round(peakStart + rng() * (52 - peakStart)))
            : Math.max(1, Math.round(1 + rng() * peakEnd));

      if (year === 2000 && week <= 8) week = 12;
      if (year === 2026 && week >= 46) week = 34;

      const date = weekToIsoDate(year, week, Math.floor(rng() * 7));
      const month = Number(date.slice(5, 7));
      // Typical Terra/Aqua/NPP overpass hours in UTC (Kazakhstan ~UTC+5/+6)
      const isDayOverpass = rng() > 0.35;
      const overpassHour = isDayOverpass
        ? 5 + Math.floor(rng() * 6) // 05:00-10:59 UTC (midday local)
        : 18 + Math.floor(rng() * 5); // 18:00-22:59 UTC (night local)
      const overpassMin = Math.floor(rng() * 60);
      const acqTimeUtc = `${String(overpassHour).padStart(2, '0')}:${String(overpassMin).padStart(2, '0')}`;

      hotspots.push({
        id: `${regionId}-${year}-${i}`,
        regionId,
        date,
        acqTimeUtc,
        dayNight: isDayOverpass ? 'D' : 'N',
        year,
        month,
        week,
        lat,
        lng,
        sensor: isViirs ? 'VIIRS' : 'MODIS',
        frpMw,
        frpUnit: 'MW',
        modisConfidencePct: isViirs ? null : Math.round(58 + intensity * 40),
        viirsConfidenceLevel: isViirs ? pickViirsConfidence(intensity) : null,
        intensity,
        dataStatus: 'demo',
      });
    }
  }

  // Second pass: compute comparable MODIS 2000-2020 baseline per week so anomalies compare like-for-like
  const modisBaselineByWeek = new Map<number, number>();
  for (let week = 1; week <= 52; week++) {
    const baselineSamples = tempWeekly.filter(
      (w) =>
        w.week === week &&
        w.year >= 2000 &&
        w.year <= 2020 &&
        w.completenessStatus === 'complete' &&
        w.wkModis !== null
    );
    if (baselineSamples.length > 0) {
      const avg =
        baselineSamples.reduce((acc, s) => acc + (s.wkModis ?? 0), 0) /
        baselineSamples.length;
      modisBaselineByWeek.set(week, Number(avg.toFixed(1)));
    }
  }

  for (const w of tempWeekly) {
    if (w.completenessStatus === 'missing') {
      weeklyActivity.push({
        year: w.year,
        week: w.week,
        metricName: 'Тепловые детекции (DEMO)',
        metricUnit: 'набл./нед.',
        modisCount: null,
        viirsCount: null,
        rawValue: null,
        harmonizedValue: null,
        baselinePeriod: '2000–2020',
        comparableSeriesLabel: 'MODIS (1000 м)',
        historicalBaseline: modisBaselineByWeek.get(w.week) ?? null,
        anomalyValue: null,
        anomalyPct: null,
        totalFrpMw: null,
        completenessStatus: 'missing',
        completenessNote: w.completenessNote,
      });
      continue;
    }

    const rawValue = (w.wkModis ?? 0) + (w.wkViirs ?? 0);
    const baseline = modisBaselineByWeek.get(w.week) ?? null;
    // Comparable anomaly strictly computed on MODIS series against 2000-2020 MODIS norm
    const anomalyValue =
      baseline !== null && w.wkModis !== null
        ? Number((w.wkModis - baseline).toFixed(1))
        : null;
    const anomalyPct =
      baseline !== null && baseline > 0 && anomalyValue !== null
        ? Number(((anomalyValue / baseline) * 100).toFixed(1))
        : null;

    weeklyActivity.push({
      year: w.year,
      week: w.week,
      metricName: 'Тепловые детекции (DEMO)',
      metricUnit: 'набл./нед.',
      modisCount: w.wkModis,
      viirsCount: w.wkViirs,
      rawValue,
      harmonizedValue: null,
      baselinePeriod: '2000–2020',
      comparableSeriesLabel: 'MODIS (1000 м)',
      historicalBaseline: baseline,
      anomalyValue,
      anomalyPct,
      totalFrpMw: w.totalFrpMw,
      completenessStatus: w.completenessStatus,
      completenessNote: w.completenessNote,
    });
  }

  return {
    regionId,
    annualSeries,
    weeklyActivity,
    hotspots,
    harmonization: null,
  };
}

export const DEMO_DATASET: FireLensDataset = {
  schemaVersion: '2.1.0',
  dataMode: 'demo',
  sourceName: 'DEMO · Демонстрационный набор (2000–2026)',
  generatedAt: '2026-11-13T00:00:00Z',
  yearRange: [2000, 2026],
  provenance: {
    sourceName: 'DEMO (синтетическая модель для демонстрации, не NASA FIRMS)',
    productNames: [
      'MODIS Collection 6.1 (MCD14ML) — целевой формат',
      'VIIRS I-Band 375 m (VNP14IMG / VJ114IMG) — целевой формат',
    ],
    observationPeriod: '2000–2026 (2026 год не завершён)',
    metricName: 'Количество тепловых аномалий и мощность FRP',
    metricUnit: 'набл. / МВт',
    processingMethod: null,
    limitations: [
      'Встроенные точки и ряды являются демонстрационными (DEMO) и не отражают реальную пожарную обстановку.',
      'Историческая гармонизация не вычисляется. Эксперимент FRP доступен в отдельной панели без заявления о научной валидации.',
      'Спутниковая тепловая детекция не равнозначна подтверждённому пожару или его причине.',
    ],
  },
  sensors: {
    MODIS: {
      id: 'MODIS',
      sourceOrg: 'NASA FIRMS',
      productName: 'MODIS Collection 6.1 (MCD14ML)',
      satellites: ['Terra', 'Aqua'],
      spatialResolutionM: 1000,
      operationalStartYear: 2000,
      confidenceScale: 'percentage_0_100',
      limitations: 'Низкая чувствительность к малым очагам (<1000 м); шкала достоверности 0–100%.',
    },
    VIIRS: {
      id: 'VIIRS',
      sourceOrg: 'NASA FIRMS',
      productName: 'VIIRS I-Band 375 m (VNP14IMG / VJ114IMG)',
      satellites: ['Suomi NPP', 'NOAA-20'],
      spatialResolutionM: 375,
      operationalStartYear: 2012,
      confidenceScale: 'categorical_low_nom_high',
      limitations: 'Архив начинается с 2012 г.; категориальная достоверность low / nominal / high.',
    },
  },
  regions: DEMO_REGIONS,
  dataByRegion: {
    kazakhstan: generateRegionDemoData('kazakhstan', 1),
    siberia: generateRegionDemoData('siberia', 2),
    california: generateRegionDemoData('california', 3),
    amazon: generateRegionDemoData('amazon', 4),
    australia: generateRegionDemoData('australia', 5),
    kamchatka: generateRegionDemoData('kamchatka', 6),
  },
};
