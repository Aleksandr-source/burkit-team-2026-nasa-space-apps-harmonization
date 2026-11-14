import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type {
  AnnualObservationPoint,
  BasemapTheme,
  ComparisonMode,
  DataMode,
  FireLensDataset,
  HistoryMetricMode,
  HotspotObservation,
  NavTab,
  RegionDataset,
  RegionDefinition,
  SatelliteSensor,
  WeeklyActivityPoint,
} from '../types/firelens';
import { analyzeObservations } from '../science/analysis';
import type {ActivityCalendar,CalendarMatchLink} from '../science/calendar';
import type { Language } from '../i18n/translations';
import { translations } from '../i18n/translations';
import {
  buildPythonJsonTemplate,
  filterAnnualSeries,
  filterHotspots,
  loadDemoDataset,
  parseAndValidateFireLensJson,
} from '../data/adapters/pythonJsonAdapter';

export type SiteTheme = 'dark' | 'light';
export type MapBasemapMode = 'dark' | 'standard' | 'satellite' | 'terrain';

export interface FireLensState {
  dataset: FireLensDataset;
  activeTab: NavTab;
  language: Language;
  siteTheme: SiteTheme;
  basemapTheme: MapBasemapMode;
  selectedRegionId: string;
  selectedYear: number;
  selectedWeek: number;
  selectedDateRange: [number, number];
  dateFrom: string | null;
  dateTo: string | null;
  timeStartHour: number;
  timeEndHour: number;
  weekFilter: number | null;
  enabledSensors: Record<SatelliteSensor, boolean>;
  selectedObservation: HotspotObservation | null;
  dataMode: DataMode;
  comparisonMode: ComparisonMode;
  historyMetricMode: HistoryMetricMode;
  minIntensity: number;
  isPlaying: boolean;
  isAnalyzing: boolean;
  hasAnalyzed: boolean;
  uploadError: string | null;
  analysisVersion: number;
  scienceReport?: unknown;
  activityCalendar?: ActivityCalendar;
  calendarMatches?: CalendarMatchLink[];
  calendarMapRecordIds?: string[];
  calendarMapSelection?: {start:string;end:string;mode:'raw'|'matched';ui?:{resolution:'month'|'week';metric:'count'|'frp';series:'aqua'|'viirs'|'scaled';index:number}};
}

export type FireLensAction =
  | { type:'LOAD_ACTIVITY_CALENDAR';dataset:FireLensDataset;calendar:ActivityCalendar;matches:CalendarMatchLink[] }
  | { type:'OPEN_CALENDAR_MAP';year:number;start:string;end:string;mode:'raw'|'matched';ids:string[];sensor:'MODIS'|'VIIRS'|'both';ui?:{resolution:'month'|'week';metric:'count'|'frp';series:'aqua'|'viirs'|'scaled';index:number} }
  | { type: 'SET_TAB'; tab: NavTab }
  | { type: 'SET_LANGUAGE'; language: Language }
  | { type: 'SET_SITE_THEME'; theme: SiteTheme }
  | { type: 'SET_BASEMAP_THEME'; theme: MapBasemapMode }
  | { type: 'SET_REGION'; regionId: string }
  | { type: 'ADD_CUSTOM_REGION'; region: RegionDefinition; regionDataset: RegionDataset }
  | { type: 'SET_YEAR'; year: number }
  | { type: 'SET_WEEK'; week: number }
  | { type: 'STEP_PLAY_YEAR' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_DATE_RANGE'; range: [number, number] }
  | {
      type: 'SET_OBSERVATION_TIME_FILTER';
      dateFrom?: string | null;
      dateTo?: string | null;
      timeStartHour?: number;
      timeEndHour?: number;
    }
  | { type: 'SET_WEEK_FILTER'; week: number | null }
  | { type: 'CLEAR_OBSERVATION_FILTERS' }
  | { type: 'TOGGLE_SENSOR'; sensor: SatelliteSensor }
  | { type: 'SET_SELECTED_OBSERVATION'; observation: HotspotObservation | null }
  | { type: 'SET_COMPARISON_MODE'; mode: ComparisonMode }
  | { type: 'SET_HISTORY_METRIC_MODE'; mode: HistoryMetricMode }
  | { type: 'SET_MIN_INTENSITY'; value: number }
  | { type: 'START_ANALYSIS' }
  | { type: 'FINISH_ANALYSIS' }
  | { type: 'SCIENTIFIC_RESULT'; report: unknown }
  | { type: 'LOAD_DATASET_SUCCESS'; dataset: FireLensDataset }
  | { type: 'LOAD_DATASET_ERROR'; error: string }
  | { type: 'CLEAR_UPLOAD_ERROR' }
  | { type: 'RESET_TO_DEMO' }
  | { type: 'INSPECT_OBSERVATION_ON_MAP'; observation: HotspotObservation }
  | { type: 'JUMP_TO_PERIOD_ON_MAP'; year: number; week?: number; filterByWeek?: boolean }
  | { type: 'GO_TO_EVIDENCE_STEP'; tab: NavTab; filterByWeek?: boolean };

function regionHasVerifiedAnnualHarmonization(state: FireLensState, regionId = state.selectedRegionId): boolean {
  const rd = state.dataset.dataByRegion[regionId];
  return Boolean(
    rd?.harmonization?.verified && rd.annualSeries.some((row: AnnualObservationPoint) => row.harmonizedCount !== null)
  );
}

function regionHasVerifiedWeeklyHarmonization(state: FireLensState, regionId = state.selectedRegionId): boolean {
  const rd = state.dataset.dataByRegion[regionId];
  return Boolean(
    rd?.harmonization?.verified && rd.weeklyActivity.some((row: WeeklyActivityPoint) => row.harmonizedValue !== null)
  );
}

export function createInitialFireLensState(): FireLensState {
  const demo = loadDemoDataset();
  let savedLang: Language = 'en';
  let savedSiteTheme: SiteTheme = 'dark';
  let savedBasemap: MapBasemapMode = 'dark';

  try {
    const l = localStorage.getItem('firelens_lang');
    if (l === 'en' || l === 'ru') savedLang = l;
    const st = localStorage.getItem('firelens_theme');
    if (st === 'dark' || st === 'light') savedSiteTheme = st;
    const bm = localStorage.getItem('firelens_basemap');
    if (bm === 'dark' || bm === 'standard' || bm === 'satellite' || bm === 'terrain') savedBasemap = bm;
  } catch {
    // ignore localStorage errors
  }

  return {
    dataset: demo,
    activeTab: 'map',
    language: savedLang,
    siteTheme: savedSiteTheme,
    basemapTheme: savedBasemap,
    selectedRegionId: 'kazakhstan',
    selectedYear: 2021,
    selectedWeek: 30,
    selectedDateRange: [...demo.yearRange] as [number, number],
    dateFrom: null,
    dateTo: null,
    timeStartHour: 0,
    timeEndHour: 24,
    weekFilter: null,
    enabledSensors: { MODIS: true, VIIRS: true },
    selectedObservation: null,
    dataMode: demo.dataMode,
    comparisonMode: 'raw',
    historyMetricMode: 'raw',
    minIntensity: 0,
    isPlaying: false,
    isAnalyzing: false,
    hasAnalyzed: false,
    uploadError: null,
    analysisVersion: 0,
  };
}

export function fireLensReducer(state: FireLensState, action: FireLensAction): FireLensState {
  switch (action.type) {
    case 'LOAD_ACTIVITY_CALENDAR':
      return {...fireLensReducer(state,{type:'LOAD_DATASET_SUCCESS',dataset:action.dataset}),selectedYear:action.calendar.years.at(-1)!,activityCalendar:action.calendar,calendarMatches:action.matches,activeTab:'history'};
    case 'OPEN_CALENDAR_MAP':
      return {...state,activeTab:'map',selectedYear:action.year,isPlaying:false,weekFilter:null,dateFrom:null,dateTo:null,timeStartHour:0,timeEndHour:24,minIntensity:0,selectedObservation:null,calendarMapRecordIds:action.ids,calendarMapSelection:{start:action.start,end:action.end,mode:action.mode,ui:action.ui},enabledSensors:{MODIS:action.sensor!=='VIIRS',VIIRS:action.sensor!=='MODIS'}};
    case 'SET_TAB':
      return { ...state, activeTab: action.tab, ...(['analysis','comparison'].includes(action.tab)?{calendarMapRecordIds:undefined,calendarMapSelection:undefined}:{}) };

    case 'SET_LANGUAGE':
      try {
        localStorage.setItem('firelens_lang', action.language);
      } catch {}
      return { ...state, language: action.language };

    case 'SET_SITE_THEME':
      try {
        localStorage.setItem('firelens_theme', action.theme);
      } catch {}
      return { ...state, siteTheme: action.theme };

    case 'SET_BASEMAP_THEME':
      try {
        localStorage.setItem('firelens_basemap', action.theme);
      } catch {}
      return { ...state, basemapTheme: action.theme };

    case 'SET_REGION': {
      const hasHarmAnnual = regionHasVerifiedAnnualHarmonization(state, action.regionId);
      const hasHarmWeekly = regionHasVerifiedWeeklyHarmonization(state, action.regionId);
      return {
        ...state,
        selectedRegionId: action.regionId,
        activityCalendar: action.regionId===state.selectedRegionId?state.activityCalendar:undefined,
        calendarMapRecordIds: undefined,calendarMapSelection:undefined,
        scienceReport: undefined,
        selectedObservation: null,
        comparisonMode: state.comparisonMode === 'harmonized' && !hasHarmAnnual ? 'raw' : state.comparisonMode,
        historyMetricMode:
          state.historyMetricMode === 'harmonized' && !hasHarmWeekly ? 'raw' : state.historyMetricMode,
      };
    }

    case 'ADD_CUSTOM_REGION': {
      const exists = state.dataset.regions.some((r: RegionDefinition) => r.id === action.region.id);
      const nextRegions = exists
        ? state.dataset.regions.map((r: RegionDefinition) => (r.id === action.region.id ? action.region : r))
        : [...state.dataset.regions, action.region];
      const nextDataByRegion = {
        ...state.dataset.dataByRegion,
        [action.region.id]: action.regionDataset,
      };
      return {
        ...state,
        dataset: {
          ...state.dataset,
          regions: nextRegions,
          dataByRegion: nextDataByRegion,
        },
        selectedRegionId: action.region.id,
        activityCalendar:undefined,calendarMatches:undefined,calendarMapRecordIds:undefined,calendarMapSelection:undefined,
        scienceReport: undefined,
        selectedObservation: null,
      };
    }

    case 'SET_YEAR': {
      const [minY, maxY] = state.selectedDateRange;
      const clamped = Math.min(maxY, Math.max(minY, action.year));
      return {
        ...state,
        isPlaying: false,
        selectedYear: clamped,
        calendarMapRecordIds:undefined,calendarMapSelection:undefined,
        selectedObservation:
          state.selectedObservation?.year === clamped ? state.selectedObservation : null,
      };
    }

    case 'SET_WEEK': {
      const clampedWeek = Math.min(52, Math.max(1, Math.round(action.week)));
      return {
        ...state,
        selectedWeek: clampedWeek,
      };
    }

    case 'STEP_PLAY_YEAR': {
      const [minY, maxY] = state.selectedDateRange;
      const nextYear = state.selectedYear >= maxY ? minY : state.selectedYear + 1;
      return {
        ...state,
        selectedYear: nextYear,
        calendarMapRecordIds:undefined,calendarMapSelection:undefined,
        selectedObservation: null,
      };
    }

    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying };

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing };

    case 'SET_DATE_RANGE': {
      const [start, end] = action.range;
      const clampedYear = Math.min(end, Math.max(start, state.selectedYear));
      return {
        ...state,
        isPlaying: false,
        selectedDateRange: [start, end],
        selectedYear: clampedYear,
        selectedObservation:
          state.selectedObservation &&
          state.selectedObservation.year >= start &&
          state.selectedObservation.year <= end
            ? state.selectedObservation
            : null,
      };
    }

    case 'SET_OBSERVATION_TIME_FILTER':
      return {
        ...state,
        dateFrom: action.dateFrom !== undefined ? action.dateFrom || null : state.dateFrom,
        dateTo: action.dateTo !== undefined ? action.dateTo || null : state.dateTo,
        timeStartHour:
          action.timeStartHour !== undefined
            ? Math.min(23, Math.max(0, action.timeStartHour))
            : state.timeStartHour,
        timeEndHour:
          action.timeEndHour !== undefined
            ? Math.min(24, Math.max(1, action.timeEndHour))
            : state.timeEndHour,
        selectedObservation: null,
      };

    case 'SET_WEEK_FILTER':
      return {
        ...state,
        weekFilter: action.week,
        selectedWeek: action.week ?? state.selectedWeek,
        selectedObservation: null,
      };

    case 'CLEAR_OBSERVATION_FILTERS':
      return {
        ...state,
        calendarMapRecordIds:undefined,calendarMapSelection:undefined,
        dateFrom: null,
        dateTo: null,
        timeStartHour: 0,
        timeEndHour: 24,
        weekFilter: null,
        minIntensity: 0,
        selectedObservation: null,
      };

    case 'TOGGLE_SENSOR': {
      const nextSensors = {
        ...state.enabledSensors,
        [action.sensor]: !state.enabledSensors[action.sensor],
      };
      return {
        ...state,
        enabledSensors: nextSensors,
        selectedObservation:
          state.selectedObservation && !nextSensors[state.selectedObservation.sensor]
            ? null
            : state.selectedObservation,
      };
    }

    case 'SET_SELECTED_OBSERVATION':
      return {
        ...state,
        selectedObservation: action.observation,
        selectedWeek: action.observation ? action.observation.week : state.selectedWeek,
      };

    case 'SET_COMPARISON_MODE': {
      if (action.mode === 'harmonized' && !regionHasVerifiedAnnualHarmonization(state)) {
        return state;
      }
      return { ...state, comparisonMode: action.mode };
    }

    case 'SET_HISTORY_METRIC_MODE': {
      if (action.mode === 'harmonized' && !regionHasVerifiedWeeklyHarmonization(state)) {
        return state;
      }
      return { ...state, historyMetricMode: action.mode };
    }

    case 'SET_MIN_INTENSITY':
      return { ...state, minIntensity: action.value };

    case 'SCIENTIFIC_RESULT':
      return {...state, isAnalyzing:false, hasAnalyzed:true, analysisVersion:state.analysisVersion+1, scienceReport:action.report};
    case 'START_ANALYSIS':
      return { ...state, isAnalyzing: true };

    case 'FINISH_ANALYSIS':
      return {
        ...state,
        isAnalyzing: false,
        hasAnalyzed: true,
        analysisVersion: state.analysisVersion + 1,
      };

    case 'LOAD_DATASET_SUCCESS': {
      const firstRegion = action.dataset.regions[0];
      const [start, end] = action.dataset.yearRange;
      const clampedYear = Math.min(end, Math.max(start, state.selectedYear));
      return {
        ...state,
        dataset: action.dataset,
        activityCalendar:undefined,calendarMatches:undefined,calendarMapRecordIds:undefined,calendarMapSelection:undefined,
        dataMode: action.dataset.dataMode,
        selectedRegionId: firstRegion ? firstRegion.id : state.selectedRegionId,
        selectedDateRange: [start, end],
        selectedYear: clampedYear,
        selectedWeek: 30,
        dateFrom: null,
        dateTo: null,
        timeStartHour: 0,
        timeEndHour: 24,
        weekFilter: null,
        comparisonMode: 'raw',
        historyMetricMode: 'raw',
        selectedObservation: null,
        hasAnalyzed: true,
        uploadError: null,
        analysisVersion: state.analysisVersion + 1,
        scienceReport: undefined,
      };
    }

    case 'LOAD_DATASET_ERROR':
      return { ...state, uploadError: action.error };

    case 'CLEAR_UPLOAD_ERROR':
      return { ...state, uploadError: null };

    case 'RESET_TO_DEMO': {
      const demo = loadDemoDataset();
      return {
        ...createInitialFireLensState(),
        activeTab: state.activeTab,
        language: state.language,
        siteTheme: state.siteTheme,
        basemapTheme: state.basemapTheme,
        dataset: demo,
      };
    }

    case 'INSPECT_OBSERVATION_ON_MAP': {
      const [start, end] = state.selectedDateRange;
      const nextRange: [number, number] = [
        Math.min(start, action.observation.year),
        Math.max(end, action.observation.year),
      ];
      return {
        ...state,
        activeTab: 'map',
        isPlaying: false,
        selectedRegionId: action.observation.regionId,
        selectedDateRange: nextRange,
        selectedYear: action.observation.year,
        selectedWeek: action.observation.week,
        weekFilter: null,
        dateFrom: null,
        dateTo: null,
        enabledSensors: {
          ...state.enabledSensors,
          [action.observation.sensor]: true,
        },
        selectedObservation: action.observation,
      };
    }

    case 'JUMP_TO_PERIOD_ON_MAP': {
      const [start, end] = state.selectedDateRange;
      const nextRange: [number, number] = [
        Math.min(start, action.year),
        Math.max(end, action.year),
      ];
      return {
        ...state,
        activeTab: 'map',
        isPlaying: false,
        selectedDateRange: nextRange,
        selectedYear: action.year,
        selectedWeek: action.week ?? state.selectedWeek,
        weekFilter: action.filterByWeek ? (action.week ?? state.selectedWeek) : null,
        selectedObservation: null,
      };
    }

    case 'GO_TO_EVIDENCE_STEP':
      return {
        ...state,
        activeTab: action.tab,
        isPlaying: false,
        weekFilter: action.filterByWeek ? state.selectedWeek : state.weekFilter,
      };

    default:
      return state;
  }
}

interface FireLensContextValue {
  state: FireLensState;
  selectedRegion: RegionDefinition;
  activeRegionData: RegionDataset | undefined;
  filteredHotspots: HotspotObservation[];
  filteredAnnualSeries: AnnualObservationPoint[];
  dispatch: React.Dispatch<FireLensAction>;
  runAnalysis: () => void;
  uploadJsonFile: (file: File) => Promise<boolean>;
  downloadJsonTemplate: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const FireLensContext = createContext<FireLensContextValue | null>(null);

export function FireLensProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fireLensReducer, undefined, createInitialFireLensState);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = state.language;
    if (state.siteTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [state.siteTheme, state.language]);

  const selectedRegion = useMemo(
    () =>
      (()=>{const r=state.dataset.regions.find((r: RegionDefinition) => r.id === state.selectedRegionId) ?? state.dataset.regions[0];const names:Record<string,string>={kazakhstan:'Kazakhstan',siberia:'Siberia',california:'California',amazon:'Amazonia',amazonia:'Amazonia',australia:'SE Australia',kamchatka:'Kamchatka (no records)'};return state.language==='en'?{...r,name:names[r.id]??r.name}:r;})(),
    [state.dataset.regions, state.selectedRegionId, state.language]
  );

  const activeRegionData = useMemo(
    () => state.dataset.dataByRegion[selectedRegion.id],
    [state.dataset.dataByRegion, selectedRegion.id]
  );

  const calendarScope=useMemo(()=>state.calendarMapRecordIds?new Set(state.calendarMapRecordIds):null,[state.calendarMapRecordIds]);
  const filteredHotspots = useMemo(
    () =>
      filterHotspots(
        activeRegionData,
        {
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
        },
        'singleYear'
      ).filter(r=>!calendarScope||calendarScope.has(r.id)),
    [
      activeRegionData,
      calendarScope,
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

  const filteredAnnualSeries = useMemo(
    () =>
      filterAnnualSeries(
        activeRegionData,
        state.selectedDateRange[0],
        state.selectedDateRange[1]
      ),
    [activeRegionData, state.selectedDateRange]
  );

  useEffect(() => {
    if (!state.isPlaying) return;
    const timer = window.setInterval(() => {
      dispatch({ type: 'STEP_PLAY_YEAR' });
    }, 900);
    return () => window.clearInterval(timer);
  }, [state.isPlaying]);

  const runAnalysis = useCallback(() => {
    dispatch({ type: 'START_ANALYSIS' });
    const report = (state.scienceReport as {kind?:string}|undefined)?.kind==='overpass' ? state.scienceReport : analyzeObservations(activeRegionData?.hotspots ?? []);
    dispatch({type:'SCIENTIFIC_RESULT', report});
  }, [activeRegionData,state.scienceReport]);

  const uploadJsonFile = useCallback(async (file: File): Promise<boolean> => {
    dispatch({ type: 'CLEAR_UPLOAD_ERROR' });
    try {
      const text = await file.text();
      const outcome = parseAndValidateFireLensJson(text);
      if (!outcome.ok) {
        dispatch({
          type: 'LOAD_DATASET_ERROR',
          error: outcome.details ? `${outcome.error}: ${outcome.details}` : outcome.error,
        });
        return false;
      }
      dispatch({ type: 'LOAD_DATASET_SUCCESS', dataset: outcome.dataset });
      return true;
    } catch (err) {
      dispatch({
        type: 'LOAD_DATASET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to read JSON file',
      });
      return false;
    }
  }, []);

  const downloadJsonTemplate = useCallback(() => {
    const content = buildPythonJsonTemplate();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firelens-python-schema.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const langDict = (translations as Record<string, any>)[state.language] ?? translations.en;
      const parts = key.split('.');
      let val: any = langDict;
      for (const p of parts) {
        val = val?.[p];
      }
      if (typeof val !== 'string') {
        let fallback: any = translations.en;
        for (const p of parts) {
          fallback = fallback?.[p];
        }
        val = typeof fallback === 'string' ? fallback : key;
      }
      if (params) {
        return val.replace(/\{(\w+)\}/g, (_: string, k: string) =>
          params[k] !== undefined ? String(params[k]) : `{${k}}`
        );
      }
      return val;
    },
    [state.language]
  );

  const value = useMemo<FireLensContextValue>(
    () => ({
      state,
      selectedRegion,
      activeRegionData,
      filteredHotspots,
      filteredAnnualSeries,
      dispatch,
      runAnalysis,
      uploadJsonFile,
      downloadJsonTemplate,
      t,
    }),
    [
      state,
      selectedRegion,
      activeRegionData,
      filteredHotspots,
      filteredAnnualSeries,
      runAnalysis,
      uploadJsonFile,
      downloadJsonTemplate,
      t,
    ]
  );

  return <FireLensContext.Provider value={value}>{children}</FireLensContext.Provider>;
}

export function useFireLens(): FireLensContextValue {
  const ctx = useContext(FireLensContext);
  if (!ctx) {
    throw new Error('useFireLens must be used inside FireLensProvider');
  }
  return ctx;
}
