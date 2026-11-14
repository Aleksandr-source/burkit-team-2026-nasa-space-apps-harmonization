export type SatelliteSensor = 'MODIS' | 'VIIRS';

export type NavTab = 'map' | 'analysis' | 'comparison' | 'history';

export type DataMode = 'demo' | 'real';

export type BasemapTheme = 'dark' | 'standard' | 'satellite' | 'terrain';

export type ComparisonMode = 'raw' | 'harmonized';

export type HistoryMetricMode = 'raw' | 'harmonized' | 'anomaly';

export type CompletenessStatus = 'complete' | 'partial' | 'missing';

export type ViirsConfidenceLevel = 'low' | 'nominal' | 'high';

export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface SensorMetadata {
  id: SatelliteSensor;
  sourceOrg: string; // e.g. "NASA FIRMS"
  productName: string; // e.g. "MCD14ML Collection 6.1"
  satellites: string[];
  spatialResolutionM: number;
  operationalStartYear: number;
  confidenceScale: 'percentage_0_100' | 'categorical_low_nom_high';
  limitations: string;
}

export interface DatasetProvenanceMetadata {
  sourceName: string; // e.g. "NASA FIRMS" or "DEMO"
  productNames: string[];
  observationPeriod: string;
  metricName: string;
  metricUnit: string;
  processingMethod: string | null;
  limitations: string[];
}

export interface RegionDefinition {
  id: string;
  name: string;
  isoNumeric?: string;
  usStateFips?: string;
  boundaryType?: 'verified_geojson' | 'study_bbox';
  center: [number, number];
  zoom: number;
  bounds: GeoBounds;
  labelCoords: [number, number];
  customGeometry?: import('geojson').Geometry;
}

export interface HotspotObservation {
  id: string;
  regionId: string;
  date: string; // ISO YYYY-MM-DD
  acqTimeUtc: string | null; // "HH:MM" UTC from NASA FIRMS acq_time
  dayNight?: 'D' | 'N' | null;
  year: number;
  month: number; // 1..12
  week: number; // 1..52
  lat: number;
  lng: number;
  sensor: SatelliteSensor;
  frpMw: number; // Fire Radiative Power in MW
  frpUnit: 'MW';
  modisConfidencePct: number | null;
  viirsConfidenceLevel: ViirsConfidenceLevel | null;
  intensity: number; // normalized 0..1 for heatmap rendering
  dataStatus: DataMode;
  satellite?: string;
  detectionType?: 0 | 1 | 2 | 3 | null;
  harmonizedFrpMw?: number | null;
}

export interface AnnualObservationPoint {
  year: number;
  metricName: string;
  metricUnit: string;
  /** Full regional aggregate (not just spatial map sample) */
  modisCount: number | null;
  viirsCount: number | null;
  harmonizedCount: number | null;
  harmonizedLowerCi?: number | null;
  harmonizedUpperCi?: number | null;
  modisMeanFrpMw: number | null;
  viirsMeanFrpMw: number | null;
  harmonizedMeanFrpMw: number | null;
  completenessStatus: CompletenessStatus;
  completenessNote?: string;
}

export interface WeeklyActivityPoint {
  year: number;
  week: number; // 1..52
  metricName: string;
  metricUnit: string;
  modisCount: number | null;
  viirsCount: number | null;
  rawValue: number | null;
  harmonizedValue: number | null;
  /** Comparable baseline series identifier (e.g. "MODIS (2000–2020)") */
  baselinePeriod: string | null;
  comparableSeriesLabel: string | null;
  historicalBaseline: number | null;
  /** Anomaly calculated strictly on the comparable series */
  anomalyValue: number | null;
  anomalyPct: number | null;
  totalFrpMw: number | null;
  completenessStatus: CompletenessStatus;
  completenessNote?: string;
}

export interface HoldoutValidationMetrics {
  holdoutPeriod: string | null;
  holdoutSampleSize: number | null;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  rSquared: number | null;
  confidenceInterval95: string | null;
  unit: string;
}

export interface HarmonizationResult {
  verified: boolean;
  metricName: string;
  metricUnit: string;
  overlapPeriod: [number, number];
  calibrationPeriod: [number, number] | null;
  beforeValue: number | null;
  afterValue: number | null;
  methodName: string;
  methodVersion: string | null;
  methodologySummary: string;
  methodologySteps: string[];
  limitations?: string[];
  validation: HoldoutValidationMetrics;
}

export interface RegionDataset {
  regionId: string;
  annualSeries: AnnualObservationPoint[];
  weeklyActivity: WeeklyActivityPoint[];
  hotspots: HotspotObservation[];
  harmonization: HarmonizationResult | null;
}

/**
 * Typed FastAPI Python Backend -> FireLens Frontend JSON Contract
 */
export interface FireLensDataset {
  schemaVersion: string;
  dataMode: DataMode;
  sourceName: string;
  generatedAt: string;
  yearRange: [number, number];
  provenance: DatasetProvenanceMetadata;
  sensors: Record<SatelliteSensor, SensorMetadata>;
  regions: RegionDefinition[];
  dataByRegion: Record<string, RegionDataset>;
}

export interface DatasetLoadResult {
  ok: true;
  dataset: FireLensDataset;
}

export interface DatasetLoadError {
  ok: false;
  error: string;
  details?: string;
}

export type DatasetParseOutcome = DatasetLoadResult | DatasetLoadError;
