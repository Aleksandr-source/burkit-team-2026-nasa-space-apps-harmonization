import { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import {
  MapPin,
  Plus,
  Minus,
  Crosshair,
  Layers,
  Flame,
  AlertCircle,
  Loader2,
  X,
  Search,
  Upload,
  Globe,
  Compass,
} from 'lucide-react';
import { FireLensSelect } from './FireLensSelect';
import type {
  DataMode,
  HotspotObservation,
  RegionDefinition,
  SatelliteSensor,
} from '../types/firelens';
import type { MapBasemapMode } from '../state/FireLensContext';
import { useFireLens } from '../state/FireLensContext';
import {
  getRegionBoundaryGeoJson,
  geometryBounds, countryBounds,
  hasVerifiedRegionBoundary,
  getAllWorldCountries,
  isPointInRegionLand,
} from '../map/realGeoBoundaries';
import { BASEMAP_ATTRIBUTION, loadFireLensBasemapStyle } from '../map/mapStyles';
import { computeMapScaleLabel, hotspotsToGeoJson } from '../data/adapters/pythonJsonAdapter';

interface FireMapProps {
  regions: RegionDefinition[];
  selectedRegion: RegionDefinition;
  hotspots: HotspotObservation[];
  selectedYear: number;
  selectedObservation: HotspotObservation | null;
  enabledSensors: Record<SatelliteSensor, boolean>;
  basemapTheme: MapBasemapMode;
  dateFrom: string | null;
  dateTo: string | null;
  timeStartHour: number;
  timeEndHour: number;
  weekFilter: number | null;
  isLoading: boolean;
  dataMode: DataMode;
  onSelectRegion: (regionId: string) => void;
  onSelectObservation: (obs: HotspotObservation | null) => void;
  onToggleSensor: (sensor: SatelliteSensor) => void;
  onChangeBasemapTheme: (theme: MapBasemapMode) => void;
  onUpdateDateTimeFilter: (payload: {
    dateFrom?: string | null;
    dateTo?: string | null;
    timeStartHour?: number;
    timeEndHour?: number;
  }) => void;
  onClearWeekFilter: () => void;
  onClearAllTimeFilters: () => void;
}

interface LayerVisibility {
  heatmap: boolean;
  clusters: boolean;
  points: boolean;
  borders: boolean;
}

function safe(value: unknown): string { return String(value ?? '').replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]!)); }

function formatConfidenceHtml(props: Record<string, unknown>): string {
  const sensor = props.sensor;
  if (sensor === 'MODIS') {
    const pct = props.modisConfidencePct;
    return pct !== null && pct !== undefined && pct !== 'null'
      ? `${pct}% (MODIS 0–100%)`
      : '—';
  }
  const lvl = props.viirsConfidenceLevel;
  return lvl && lvl !== 'null' ? `${String(lvl)} (VIIRS)` : '—';
}

function formatTimeUtcHtml(props: Record<string, unknown>): string {
  const t = props.acqTimeUtc;
  return t && t !== 'null' && t !== 'undefined' ? `${String(t)} UTC` : '—';
}

function getFitPadding(container: HTMLElement | null) {
  const w = container?.clientWidth ?? 900;
  if (w < 640) {
    return { top: 44, bottom: 28, left: 20, right: 20 };
  }
  return { top: 42, bottom: 28, left: 56, right: 22 };
}

export function FireMap({
  regions,
  selectedRegion,
  hotspots,
  selectedYear,
  selectedObservation,
  enabledSensors,
  basemapTheme,
  dateFrom,
  dateTo,
  timeStartHour,
  timeEndHour,
  weekFilter,
  isLoading,
  dataMode,
  onSelectRegion,
  onSelectObservation,
  onToggleSensor,
  onChangeBasemapTheme,
  onUpdateDateTimeFilter,
  onClearWeekFilter,
  onClearAllTimeFilters,
}: FireMapProps) {
  const { dispatch, t } = useFireLens();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const detailPopupRef = useRef<maplibregl.Popup | null>(null);
  const overlayReadyRef = useRef(false);
  const initialThemeRef = useRef(basemapTheme);

  const [zoomLevel, setZoomLevel] = useState(selectedRegion.zoom);
  const [centerLat, setCenterLat] = useState(selectedRegion.center[1]);
  const [layersOpen, setLayersOpen] = useState(false);
  const [geoSearchOpen, setGeoSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [places, setPlaces] = useState<{name:string,lat:number,lng:number}[]>([]);
  const [searching,setSearching] = useState(false);
  const [coordInput, setCoordInput] = useState('');
  const [geoError, setGeoError] = useState<string | null>(null);

  const [tileWarning,setTileWarning] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>({
    heatmap: true,
    clusters: true,
    points: true,
    borders: true,
  });

  const worldCountries = useMemo(() => getAllWorldCountries(), []);

  const filteredWorldCountries = useMemo(() => {
    if (!searchQuery.trim()) return worldCountries.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return worldCountries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 40);
  }, [worldCountries, searchQuery]);

  const latestRef = useRef({
    hotspots,
    selectedRegion,
    dataMode,
    layers,
    basemapTheme,
    selectedObservation,
    onSelectObservation,
  });
  latestRef.current = {
    hotspots,
    selectedRegion,
    dataMode,
    layers,
    basemapTheme,
    selectedObservation,
    onSelectObservation,
  };

  const syncOverlayData = (map: maplibregl.Map) => {
    if (!overlayReadyRef.current) return;
    const {
      hotspots: currSpots,
      selectedRegion: currRegion,
      layers: currLayers,
      selectedObservation: currSelected,
    } = latestRef.current;

    const geojson = hotspotsToGeoJson(currSpots);

    const heatSource = map.getSource('fire-heatmap-source') as maplibregl.GeoJSONSource | undefined;
    if (heatSource) heatSource.setData(geojson);

    const clusterSource = map.getSource('fire-clusters-source') as maplibregl.GeoJSONSource | undefined;
    if (clusterSource) clusterSource.setData(geojson);

    const rawSource = map.getSource('fire-points-raw-source') as maplibregl.GeoJSONSource | undefined;
    if (rawSource) rawSource.setData(geojson);

    const boundarySource = map.getSource('selected-region-boundary') as maplibregl.GeoJSONSource | undefined;
    if (boundarySource) boundarySource.setData(getRegionBoundaryGeoJson(currRegion));

    const selectedSource = map.getSource('selected-observation-source') as maplibregl.GeoJSONSource | undefined;
    if (selectedSource) {
      selectedSource.setData(
        currSelected ? hotspotsToGeoJson([currSelected]) : hotspotsToGeoJson([])
      );
    }

    if (map.getLayer('fire-heatmap')) {
      map.setLayoutProperty('fire-heatmap', 'visibility', currLayers.heatmap ? 'visible' : 'none');
    }

    const showClusters = currLayers.clusters;
    const showPoints = currLayers.points;

    if (map.getLayer('fire-clusters')) {
      map.setLayoutProperty('fire-clusters', 'visibility', showClusters ? 'visible' : 'none');
    }
    if (map.getLayer('fire-cluster-count')) {
      map.setLayoutProperty('fire-cluster-count', 'visibility', showClusters ? 'visible' : 'none');
    }
    if (map.getLayer('fire-points')) {
      map.setLayoutProperty(
        'fire-points',
        'visibility',
        showClusters && showPoints ? 'visible' : 'none'
      );
    }
    if (map.getLayer('fire-points-raw')) {
      map.setLayoutProperty(
        'fire-points-raw',
        'visibility',
        !showClusters && showPoints ? 'visible' : 'none'
      );
    }
    const showBoundaries = currLayers.borders && hasVerifiedRegionBoundary(currRegion);
    for (const bLayer of ['region-fill', 'region-glow', 'region-border']) {
      if (map.getLayer(bLayer)) {
        map.setLayoutProperty(bLayer, 'visibility', showBoundaries ? 'visible' : 'none');
      }
    }
  };

  const showObservationPopup = (
    map: maplibregl.Map,
    obs: HotspotObservation | null,
    mode: DataMode,
    flyDuration = 600
  ) => {
    if (!obs) {
      detailPopupRef.current?.remove();
      detailPopupRef.current = null;
      return;
    }

    const isDemo = mode === 'demo';
    const confStr = formatConfidenceHtml(obs as unknown as Record<string, unknown>);
    const timeStr = obs.acqTimeUtc ? `${obs.acqTimeUtc} UTC` : '—';

    detailPopupRef.current?.remove();
    detailPopupRef.current = new maplibregl.Popup({ offset: 12 })
      .setLngLat([obs.lng, obs.lat])
      .setHTML(
        `<div style="min-width:220px;font-size:12px;line-height:1.5;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-right:18px;margin-bottom:4px;">
            <strong style="color:#fff;font-size:13px;">${safe(obs.sensor)}</strong>
            <span style="color:${obs.sensor === 'VIIRS' ? '#c084fc' : '#38bdf8'};font-family:var(--font-mono);font-size:11px;">${safe(obs.date)}</span>
          </div>
          <div style="color:#cbd5e1;font-family:var(--font-mono);font-size:11px;">
            UTC: <strong style="color:#fff">${safe(timeStr)}</strong>
          </div>
          <div style="color:#cbd5e1;font-family:var(--font-mono);font-size:11px;">
            Coords: ${obs.lat.toFixed(4)}°, ${obs.lng.toFixed(4)}°
          </div>
          <div style="margin-top:6px;display:grid;grid-template-columns:1fr;gap:4px;border-top:1px solid rgba(148,163,184,0.2);padding-top:6px;">
            <div><span style="color:#94a3b8;">FRP:</span> <strong style="color:#fbbf24;">${obs.frpMw} MW</strong></div>
            <div><span style="color:#94a3b8;">Conf:</span> <strong style="color:#4ade80;">${safe(confStr)}</strong></div>
          </div>
          <div style="margin-top:6px;font-size:10px;color:${isDemo ? '#fcd34d' : '#6ee7b7'};">
            ${isDemo ? 'DEMO observation' : 'Uploaded JSON observation'}
          </div>
        </div>`
      )
      .addTo(map);

    if (map.getZoom() < 5.5) {
      map.flyTo({
        center: [obs.lng, obs.lat],
        zoom: 6.4,
        duration: flyDuration,
      });
    }
  };

  const attachFireLensOverlays = (map: maplibregl.Map) => {
    const {
      selectedRegion: currRegion,
      hotspots: currSpots,
      basemapTheme: currTheme,
    } = latestRef.current;
    const initGeo = hotspotsToGeoJson(currSpots);
    const hasGlyphs = Boolean(map.getStyle()?.glyphs);
    const isRaster = currTheme === 'satellite' || currTheme === 'terrain';

    if (!map.getSource('selected-region-boundary')) {
      map.addSource('selected-region-boundary', {
        type: 'geojson',
        data: getRegionBoundaryGeoJson(currRegion),
      });
    }
    if (!map.getSource('fire-heatmap-source')) {
      map.addSource('fire-heatmap-source', {
        type: 'geojson',
        data: initGeo,
      });
    }
    if (!map.getSource('fire-clusters-source')) {
      map.addSource('fire-clusters-source', {
        type: 'geojson',
        data: initGeo,
        cluster: true,
        clusterMaxZoom: 7,
        clusterRadius: 42,
      });
    }
    if (!map.getSource('fire-points-raw-source')) {
      map.addSource('fire-points-raw-source', {
        type: 'geojson',
        data: initGeo,
      });
    }
    if (!map.getSource('selected-observation-source')) {
      map.addSource('selected-observation-source', {
        type: 'geojson',
        data: hotspotsToGeoJson([]),
      });
    }

    if (!map.getLayer('region-fill') && !isRaster) {
      map.addLayer({
        id: 'region-fill',
        type: 'fill',
        source: 'selected-region-boundary',
        paint: {
          'fill-color': currTheme === 'standard' ? '#16a34a' : '#133a25',
          'fill-opacity': currTheme === 'standard' ? 0.08 : 0.16,
        },
      });
    }

    if (!map.getLayer('region-glow')) {
      map.addLayer({
        id: 'region-glow',
        type: 'line',
        source: 'selected-region-boundary',
        paint: {
          'line-color': currTheme === 'standard' ? '#15803d' : '#74f04d',
          'line-width': 5.5,
          'line-blur': 4,
          'line-opacity': currTheme === 'standard' ? 0.28 : 0.42,
        },
      });
    }

    if (!map.getLayer('region-border')) {
      map.addLayer({
        id: 'region-border',
        type: 'line',
        source: 'selected-region-boundary',
        paint: {
          'line-color': currTheme === 'standard' ? '#16a34a' : '#86f754',
          'line-width': currTheme === 'standard' ? 2.2 : 1.8,
        },
      });
    }

    if (!map.getLayer('fire-heatmap') && !isRaster) {
      map.addLayer({
        id: 'fire-heatmap',
        type: 'heatmap',
        source: 'fire-heatmap-source',
        maxzoom: 11,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0.25, 1, 1.5],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 1.0, 8, 2.0],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0, 0, 0, 0)',
            0.22,
            'rgba(234, 88, 12, 0.34)',
            0.48,
            'rgba(249, 115, 22, 0.65)',
            0.76,
            'rgba(250, 204, 21, 0.85)',
            1,
            'rgba(254, 249, 195, 0.95)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 12, 8, 22],
          'heatmap-opacity': 0.6,
        },
      });
    }

    if (!map.getLayer('fire-clusters')) {
      map.addLayer({
        id: 'fire-clusters',
        type: 'circle',
        source: 'fire-clusters-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            'rgba(249, 115, 22, 0.9)',
            12,
            'rgba(239, 68, 68, 0.92)',
            28,
            'rgba(220, 38, 38, 0.96)',
          ],
          'circle-radius': ['step', ['get', 'point_count'], 13, 12, 17, 28, 21],
          'circle-stroke-width': 1.6,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    if (hasGlyphs && !map.getLayer('fire-cluster-count')) {
      map.addLayer({
        id: 'fire-cluster-count',
        type: 'symbol',
        source: 'fire-clusters-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: {
          'text-color': '#ffffff',
        },
      });
    }

    if (!map.getLayer('fire-points')) {
      map.addLayer({
        id: 'fire-points',
        type: 'circle',
        source: 'fire-clusters-source',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.2, 4.5, 1, 7.5],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'intensity'],
            0.2,
            '#fde047',
            0.6,
            '#f97316',
            0.9,
            '#ef4444',
          ],
          'circle-stroke-width': 1.6,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'sensor'], 'VIIRS'],
            '#c084fc',
            '#38bdf8',
          ],
        },
      });
    }

    if (!map.getLayer('fire-points-raw')) {
      map.addLayer({
        id: 'fire-points-raw',
        type: 'circle',
        source: 'fire-points-raw-source',
        layout: {
          visibility: 'none',
        },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'intensity'], 0.2, 4.5, 1, 7.5],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'intensity'],
            0.2,
            '#fde047',
            0.6,
            '#f97316',
            0.9,
            '#ef4444',
          ],
          'circle-stroke-width': 1.6,
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'sensor'], 'VIIRS'],
            '#c084fc',
            '#38bdf8',
          ],
        },
      });
    }

    if (!map.getLayer('fire-selected-ring')) {
      map.addLayer({
        id: 'fire-selected-ring',
        type: 'circle',
        source: 'selected-observation-source',
        paint: {
          'circle-radius': 14,
          'circle-color': 'transparent',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#74f04d',
        },
      });
    }

    overlayReadyRef.current = true;
    syncOverlayData(map);
  };

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let cancelled = false;
    let map: maplibregl.Map | null = null;

    const setup = async () => {
      const style = await loadFireLensBasemapStyle(initialThemeRef.current);
      if (cancelled || !mapContainerRef.current) return;

      try {
        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style,
          center: latestRef.current.selectedRegion.center,
          zoom: latestRef.current.selectedRegion.zoom,
          minZoom: 1.5,
          maxZoom: 16,
          attributionControl: false,
          canvasContextAttributes: { preserveDrawingBuffer: true },
        });
      } catch (err) {
        setMapError(err instanceof Error ? err.message : 'Failed to initialize MapLibre GL');
        return;
      }

      mapRef.current = map;
      map.on('error',()=>setTileWarning(true));

      map.on('styleimagemissing', (e: { id: string }) => {
        if (!map || map.hasImage(e.id)) return;
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      map.on('load', () => {
        if (!map || cancelled) return;
        const {
          selectedRegion: initRegion,
          selectedObservation: initSelected,
          dataMode: initMode,
        } = latestRef.current;
        attachFireLensOverlays(map);

        map.resize();
        map.fitBounds(
          [
            [initRegion.bounds.west, initRegion.bounds.south],
            [initRegion.bounds.east, initRegion.bounds.north],
          ],
          { padding: getFitPadding(mapContainerRef.current), duration: 0 }
        );

        if (initSelected) {
          showObservationPopup(map, initSelected, initMode, 0);
        }
      });

      map.on('moveend', () => {
        if (!map) return;
        setZoomLevel(map.getZoom());
        setCenterLat(map.getCenter().lat);
      });

      map.on('mouseenter', 'fire-clusters', (e: maplibregl.MapLayerMouseEvent) => {
        if (!map) return;
        map.getCanvas().style.cursor = 'pointer';
        const feat = e.features?.[0];
        if (!feat || feat.geometry.type !== 'Point') return;
        const count = feat.properties?.point_count ?? 0;
        hoverPopupRef.current?.remove();
        hoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
        })
          .setLngLat(feat.geometry.coordinates as [number, number])
          .setHTML(`<div style="font-size:11px;"><strong>Cluster: ${count} obs.</strong></div>`)
          .addTo(map);
      });

      map.on('mouseleave', 'fire-clusters', () => {
        if (!map) return;
        map.getCanvas().style.cursor = '';
        hoverPopupRef.current?.remove();
      });

      map.on('click', 'fire-clusters', async (e: maplibregl.MapLayerMouseEvent) => {
        if (!map) return;
        const feat = e.features?.[0];
        if (!feat || feat.geometry.type !== 'Point') return;
        const clusterId = feat.properties?.cluster_id;
        const src = map.getSource('fire-clusters-source') as maplibregl.GeoJSONSource | undefined;
        if (src && typeof clusterId === 'number') {
          try {
            const zoom = await src.getClusterExpansionZoom(clusterId);
            map.easeTo({
              center: feat.geometry.coordinates as [number, number],
              zoom: zoom + 0.5,
              duration: 450,
            });
          } catch {}
        }
      });

      const handlePointHover = (e: maplibregl.MapLayerMouseEvent) => {
        if (!map) return;
        map.getCanvas().style.cursor = 'pointer';
        const feat = e.features?.[0];
        if (!feat || feat.geometry.type !== 'Point') return;
        const p = feat.properties as Record<string, unknown>;
        const isDemo = latestRef.current.dataMode === 'demo';
        const latVal = Number(p.lat);
        const lngVal = Number(p.lng);
        const confStr = formatConfidenceHtml(p);
        const timeStr = formatTimeUtcHtml(p);

        hoverPopupRef.current?.remove();
        hoverPopupRef.current = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 10,
        })
          .setLngLat(feat.geometry.coordinates as [number, number])
          .setHTML(
            `<div style="font-size:11px;line-height:1.45;min-width:180px;">
              <div><strong style="color:#fff">${safe(p.sensor)}</strong> · <span style="font-family:var(--font-mono)">${safe(p.date)} · ${safe(timeStr)}</span></div>
              <div style="color:#cbd5e1;font-family:var(--font-mono);font-size:10px;">${latVal.toFixed(4)}°, ${lngVal.toFixed(4)}°</div>
              <div>FRP: <strong style="color:#fbbf24">${safe(p.frpMw)} MW</strong> · Conf: <strong style="color:#4ade80">${safe(confStr)}</strong></div>
              ${isDemo ? '<div style="color:#fcd34d;font-size:10px">DEMO observation</div>' : ''}
            </div>`
          )
          .addTo(map);
      };

      const handlePointLeave = () => {
        if (!map) return;
        map.getCanvas().style.cursor = '';
        hoverPopupRef.current?.remove();
      };

      const handlePointClick = (e: maplibregl.MapLayerMouseEvent) => {
        if (!map) return;
        const feat = e.features?.[0];
        if (!feat || feat.geometry.type !== 'Point') return;
        const props = feat.properties as Record<string, unknown>;
        const matched = latestRef.current.hotspots.find((h) => h.id === props.id);
        if (matched) {
          latestRef.current.onSelectObservation(matched);
        }
      };

      map.on('mouseenter', 'fire-points', handlePointHover);
      map.on('mouseleave', 'fire-points', handlePointLeave);
      map.on('click', 'fire-points', handlePointClick);

      map.on('mouseenter', 'fire-points-raw', handlePointHover);
      map.on('mouseleave', 'fire-points-raw', handlePointLeave);
      map.on('click', 'fire-points-raw', handlePointClick);
    };

    setup();

    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      hoverPopupRef.current?.remove();
      detailPopupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      overlayReadyRef.current = false;
    };
  }, []);

  const prevThemeRef = useRef<MapBasemapMode>(basemapTheme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || prevThemeRef.current === basemapTheme) return;
    prevThemeRef.current = basemapTheme;

    let cancelled = false;
    const applyStyle = async () => {
      setTileWarning(false);
      const nextStyle = await loadFireLensBasemapStyle(basemapTheme);
      if (cancelled || !mapRef.current) return;
      overlayReadyRef.current = false;
      map.once('style.load', () => {
        if (cancelled || !mapRef.current) return;
        attachFireLensOverlays(map);
      });
      map.setStyle(nextStyle);
    };
    void applyStyle();

    return () => {
      cancelled = true;
    };
  }, [basemapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncOverlayData(map);
  }, [hotspots, layers, selectedRegion, selectedObservation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    hoverPopupRef.current?.remove();
    detailPopupRef.current?.remove();
    map.resize();
    map.fitBounds(
      [
        [selectedRegion.bounds.west, selectedRegion.bounds.south],
        [selectedRegion.bounds.east, selectedRegion.bounds.north],
      ],
      { padding: getFitPadding(mapContainerRef.current), duration: 650, essential: true }
    );
  }, [selectedRegion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    showObservationPopup(map, selectedObservation, dataMode, 600);
  }, [selectedObservation, dataMode]);

  const handleZoomIn = () => mapRef.current?.zoomIn({ duration: 220 });
  const handleZoomOut = () => mapRef.current?.zoomOut({ duration: 220 });
  const handleResetView = () => {
    mapRef.current?.fitBounds(
      [
        [selectedRegion.bounds.west, selectedRegion.bounds.south],
        [selectedRegion.bounds.east, selectedRegion.bounds.north],
      ],
      { padding: getFitPadding(mapContainerRef.current), duration: 500 }
    );
  };

  const scaleLabel = computeMapScaleLabel(zoomLevel, centerLat).replace('км', document.documentElement.lang==='en'?'km':'км');
  const hasVerifiedBoundary = hasVerifiedRegionBoundary(selectedRegion);
  const hasTimeFilter =
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    timeStartHour !== 0 ||
    timeEndHour !== 24 ||
    weekFilter !== null;

  const yearMinDate = `${selectedYear}-01-01`;
  const yearMaxDate = `${selectedYear}-12-31`;

  return (
    <div className="firelens-panel relative h-[430px] sm:h-[510px] lg:h-[580px] w-full overflow-hidden rounded-2xl">
      {mapError ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-slate-300">
          <AlertCircle className="h-8 w-8 text-rose-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">{mapError}</p>
        </div>
      ) : (
        <div
          ref={mapContainerRef}
          data-testid="firelens-map-canvas"
          className="h-full w-full"
          aria-label={`Interactive map of ${selectedRegion.name} for year ${selectedYear}`}
        />
      )}

      {/* Top-Left Region Selector / Search */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setGeoSearchOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-[#081523]/92 px-3 py-2.5 text-sm font-medium text-white shadow-lg backdrop-blur-md hover:border-emerald-400/70"
          >
            <MapPin className="h-4 w-4 text-[#6ee755]" aria-hidden="true" />
            <span className="max-w-[160px] truncate">{selectedRegion.name}</span>
            <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          </button>

          {geoSearchOpen && (
            <div className="absolute top-full left-0 mt-2 z-50 w-72 sm:w-80 rounded-2xl border border-emerald-400/40 bg-[#071322]/98 p-3.5 shadow-2xl backdrop-blur-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold text-white uppercase tracking-wider">
                  {t('geography.selectRegion')}
                </span>
                <button
                  type="button"
                  onClick={() => setGeoSearchOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Search input for countries */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('geography.searchCountry')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#040b14] pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <button type="button" disabled={searching || searchQuery.trim().length<2} className="text-xs border rounded-lg p-2" onClick={async()=>{setSearching(true);setGeoError(null);setPlaces([]);try{const r=await fetch(`/api/search?${new URLSearchParams({q:searchQuery,lang:document.documentElement.lang})}`);const data=await r.json();if(!r.ok)throw Error(data.error);setPlaces(data.results);if(!data.results.length)setGeoError('No results / Нет результатов');}catch(e){setGeoError(String(e));}finally{setSearching(false);}}}>{searching?'…':document.documentElement.lang==='ru'?'Поиск городов':'Search cities'}</button>
              {places.map((p,i)=><button key={i} type="button" className="block text-left text-xs py-1" onClick={()=>{const id=`place-${p.lat}-${p.lng}`;const region:RegionDefinition={id,name:p.name,center:[p.lng,p.lat],labelCoords:[p.lng,p.lat],zoom:8,bounds:{west:Math.max(-180,p.lng-0.5),east:Math.min(180,p.lng+0.5),south:Math.max(-85,p.lat-0.5),north:Math.min(85,p.lat+0.5)},boundaryType:'study_bbox'};dispatch({type:'ADD_CUSTOM_REGION',region,regionDataset:{regionId:id,annualSeries:[],weeklyActivity:[],hotspots:[],harmonization:null}});setGeoSearchOpen(false);}}>{p.name}</button>)}
              {places.length>0&&<p className="text-[10px]">Open-Meteo / GeoNames</p>}
              {geoError && (
                <div className="text-[11px] text-rose-300 bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
                  {geoError}
                </div>
              )}

              {/* Coordinate search input */}
              <div className="border-t border-slate-800 pt-2.5">
                <label className="block text-[11px] text-slate-400 mb-1">
                  {t('geography.coordsPrompt')}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. 51.16, 71.47"
                    value={coordInput}
                    onChange={(e) => setCoordInput(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-700 bg-[#040b14] px-2.5 py-1 text-xs text-white font-mono-tabular focus:border-emerald-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setGeoError(null);
                      const parts = coordInput.split(',').map((s) => Number(s.trim()));
                      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Math.abs(parts[0]) <= 85 && Math.abs(parts[1]) <= 178 && coordInput.split(',').every(s=>s.trim())) {
                        const [lat, lng] = parts;
                        const customId = `coord-${lat}-${lng}`;
                        const customReg: RegionDefinition = {
                          id: customId,
                          name: `Coord (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
                          center: [lng, lat],
                          zoom: 7.0,
                          bounds: { west: lng - 2, south: lat - 2, east: lng + 2, north: lat + 2 },
                          labelCoords: [lng, lat],
                          boundaryType: 'study_bbox',
                        };
                        const dummyRegionDataset = {regionId:customId, annualSeries:[], weeklyActivity:[], hotspots:[], harmonization:null};
                        dispatch({
                          type: 'ADD_CUSTOM_REGION',
                          region: customReg,
                          regionDataset: dummyRegionDataset as any,
                        });
                        setGeoSearchOpen(false);
                        setCoordInput('');
                      } else {
                        setGeoError('Invalid lat, lng format');
                      }
                    }}
                    className="rounded-lg bg-emerald-500/20 border border-emerald-400/50 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
                  >
                    Go
                  </button>
                </div>
              </div>

              {/* GeoJSON Polygon Upload */}
              <div className="border-t border-slate-800 pt-2.5">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-[#040b14] py-2 text-xs font-medium text-slate-300 hover:border-emerald-400/60 hover:text-white">
                  <Upload className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{t('geography.uploadGeojson')}</span>
                  <input
                    type="file"
                    accept="application/json,.geojson"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const txt = await file.text();
                        const gj = JSON.parse(txt);
                        const feat = gj.features?.[0] ?? (gj.geometry ? gj : null);
                        if (!feat) throw new Error('No valid GeoJSON geometry found');
                        const coords = feat.geometry?.coordinates ?? feat.coordinates;
                        if (!coords) throw new Error('Invalid GeoJSON coordinates');
                        const bounds = geometryBounds(feat.geometry ?? feat);
                        const regId = `geojson-${Date.now()}`;
                        const regName = file.name.replace(/\.[^/.]+$/, '');
                        const customReg: RegionDefinition = {
                          id: regId,
                          name: regName,
                          center: [(bounds.west+bounds.east)/2, (bounds.south+bounds.north)/2],
                          zoom: 5.0,
                          bounds,
                          customGeometry: feat.geometry ?? feat,
                          labelCoords: [(bounds.west+bounds.east)/2, (bounds.south+bounds.north)/2],
                          boundaryType: 'study_bbox',
                        };
                        dispatch({
                          type: 'ADD_CUSTOM_REGION',
                          region: customReg,
                          regionDataset: {
                            regionId: regId,
                            annualSeries: [],
                            weeklyActivity: [],
                            hotspots: [],
                            harmonization: null,
                          },
                        });
                        setGeoSearchOpen(false);
                      } catch (err) {
                        setGeoError(err instanceof Error ? err.message : 'Invalid GeoJSON file');
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {/* Featured & Countries Lists */}
              <div className="max-h-48 overflow-y-auto space-y-1 border-t border-slate-800 pt-2">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">
                  {t('geography.featuredCategory')}
                </div>
                {regions.map((reg) => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => {
                      onSelectRegion(reg.id);
                      setGeoSearchOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      reg.id === selectedRegion.id
                        ? 'bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-400/40'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{document.documentElement.lang==='en'?({kazakhstan:'Kazakhstan',siberia:'Siberia',california:'California',amazon:'Amazonia',amazonia:'Amazonia',australia:'SE Australia',kamchatka:'Kamchatka (no records)'} as Record<string,string>)[reg.id]??reg.name:reg.name}</span>
                    <Globe className="h-3 w-3 text-slate-500" />
                  </button>
                ))}

                <div className="pt-2 text-[10px] font-semibold text-slate-400 uppercase">
                  {t('geography.countriesCategory')}
                </div>
                {filteredWorldCountries.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const bounds = countryBounds(c.isoNumeric);
                      const countryReg: RegionDefinition = {
                        id: c.id,
                        name: c.name,
                        isoNumeric: c.isoNumeric,
                        boundaryType: 'verified_geojson',
                        center: [(bounds.west+bounds.east)/2, (bounds.south+bounds.north)/2],
                        zoom: 3.8,
                        bounds,
                        labelCoords: [0, 20],
                      };
                      dispatch({
                        type: 'ADD_CUSTOM_REGION',
                        region: countryReg,
                        regionDataset: {
                          regionId: c.id,
                          annualSeries: [],
                          weeklyActivity: [],
                          hotspots: [],
                          harmonization: null,
                        },
                      });
                      setGeoSearchOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <span>{c.name}</span>
                    <span className="font-mono-tabular text-[10px] text-slate-500">ISO {c.isoNumeric}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-Right Basemap Switcher (4 modes: Standard, Satellite, Terrain, Dark) */}
      <div className="absolute top-16 sm:top-4 right-4 z-30 flex items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-[#081523]/92 p-1 backdrop-blur-md shadow-lg">
        {[
          { id: 'standard' as MapBasemapMode, label: t('mapPage.basemaps.standard') },
          { id: 'satellite' as MapBasemapMode, label: t('mapPage.basemaps.satellite') },
          { id: 'terrain' as MapBasemapMode, label: t('mapPage.basemaps.terrain') },
          { id: 'dark' as MapBasemapMode, label: t('mapPage.basemaps.dark') },
        ].map((bm) => {
          const isActive = basemapTheme === bm.id;
          return (
            <button
              key={bm.id}
              type="button"
              onClick={() => onChangeBasemapTheme(bm.id)}
              aria-pressed={isActive}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-400/60 shadow-sm'
                  : 'text-slate-300 hover:text-white border border-transparent'
              }`}
            >
              {bm.label}
            </button>
          );
        })}
      </div>

      {/* Left Map Controls (+, -, Reset, Layers & Time Filter) */}
      <div className={`absolute top-20 left-4 flex flex-col gap-2.5 ${layersOpen ? 'z-40' : 'z-20'}`}>
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-700/80 bg-[#081523]/92 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label={t('mapPage.zoomIn')}
            className="flex h-9 w-9 items-center justify-center border-b border-slate-700/70 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label={t('mapPage.zoomOut')}
            className="flex h-9 w-9 items-center justify-center text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleResetView}
          aria-label={t('mapPage.resetView')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/80 bg-[#081523]/92 text-slate-200 backdrop-blur-md shadow-lg transition-colors hover:border-emerald-400/50 hover:text-emerald-300"
        >
          <Crosshair className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setLayersOpen((prev) => !prev)}
            aria-label={t('mapPage.layers')}
            aria-expanded={layersOpen}
            data-testid="map-layers-btn"
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl border backdrop-blur-md shadow-lg transition-colors ${
              layersOpen
                ? 'border-emerald-400/80 bg-emerald-950/80 text-emerald-300'
                : 'border-slate-700/80 bg-[#081523]/92 text-slate-200 hover:border-emerald-400/50'
            }`}
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            {hasTimeFilter && (
              <span
                className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#081523]"
                aria-hidden="true"
              />
            )}
          </button>

          {layersOpen && (
            <div
              data-testid="map-layers-popover"
              className="absolute top-0 left-11 z-50 w-72 max-h-[360px] overflow-y-auto rounded-xl border border-emerald-400/35 bg-[#081523] p-3 text-xs text-slate-200 shadow-2xl space-y-3"
            >
              <div>
                <div className="mb-2 font-semibold text-white">{t('mapPage.layersTitle')}</div>
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enabledSensors.MODIS}
                      onChange={() => onToggleSensor('MODIS')}
                      className="rounded border-slate-600 accent-emerald-400"
                    />
                    <span>{t('mapPage.modisDetections')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enabledSensors.VIIRS}
                      onChange={() => onToggleSensor('VIIRS')}
                      className="rounded border-slate-600 accent-emerald-400"
                    />
                    <span>{t('mapPage.viirsDetections')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.clusters}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, clusters: e.target.checked }))
                      }
                      className="rounded border-slate-600 accent-emerald-400"
                    />
                    <span>{t('mapPage.clusters')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.points}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, points: e.target.checked }))
                      }
                      className="rounded border-slate-600 accent-emerald-400"
                    />
                    <span>{t('mapPage.individualPoints')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.heatmap}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, heatmap: e.target.checked }))
                      }
                      className="rounded border-slate-600 accent-emerald-400"
                    />
                    <span>{t('mapPage.heatmap')}</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 ${
                      hasVerifiedBoundary ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={hasVerifiedBoundary && layers.borders}
                      disabled={!hasVerifiedBoundary}
                      onChange={(e) =>
                        setLayers((prev) => ({ ...prev, borders: e.target.checked }))
                      }
                      className="rounded border-slate-600 accent-emerald-400"
                    />
                    <span>
                      {hasVerifiedBoundary
                        ? selectedRegion.customGeometry ? (document.documentElement.lang==='ru'?'Контур пользователя':'User study boundary') : t('mapPage.boundaries')
                        : t('mapPage.studyAreaBounds')}
                    </span>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{t('mapPage.dateTimeUtc')}</span>
                  {hasTimeFilter && (
                    <button
                      type="button"
                      onClick={onClearAllTimeFilters}
                      className="text-[10px] font-medium text-emerald-300 hover:underline"
                    >
                      {t('mapPage.reset')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label htmlFor="map-date-from" className="block text-[10px] text-slate-400">
                      {t('mapPage.startDate')}
                    </label>
                    <input
                      id="map-date-from"
                      type="date"
                      min={yearMinDate}
                      max={yearMaxDate}
                      value={dateFrom ?? ''}
                      onChange={(e) =>
                        onUpdateDateTimeFilter({ dateFrom: e.target.value || null })
                      }
                      className="mt-0.5 w-full rounded-md border border-slate-700 bg-[#040b14] px-1.5 py-1 font-mono-tabular text-[10px] text-slate-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="map-date-to" className="block text-[10px] text-slate-400">
                      {t('mapPage.endDate')}
                    </label>
                    <input
                      id="map-date-to"
                      type="date"
                      min={yearMinDate}
                      max={yearMaxDate}
                      value={dateTo ?? ''}
                      onChange={(e) =>
                        onUpdateDateTimeFilter({ dateTo: e.target.value || null })
                      }
                      className="mt-0.5 w-full rounded-md border border-slate-700 bg-[#040b14] px-1.5 py-1 font-mono-tabular text-[10px] text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{t('mapPage.timeOfDay')}</span>
                    <span className="font-mono-tabular text-emerald-300">
                      {String(timeStartHour).padStart(2, '0')}:00–
                      {String(timeEndHour).padStart(2, '0')}:00
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { label: t('mapPage.allDay'), start: 0, end: 24 },
                      { label: t('mapPage.dayTime'), start: 4, end: 16 },
                      { label: t('mapPage.nightTime'), start: 16, end: 4 },
                    ].map((preset) => {
                      const active =
                        timeStartHour === preset.start && timeEndHour === preset.end;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            onUpdateDateTimeFilter({
                              timeStartHour: preset.start,
                              timeEndHour: preset.end,
                            })
                          }
                          aria-pressed={active}
                          className={`rounded-md border py-1 text-[10px] font-medium transition-colors ${
                            active
                              ? 'border-emerald-400/60 bg-emerald-950/70 text-emerald-300'
                              : 'border-slate-700/80 bg-[#040b14] text-slate-400 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top-right status badge / empty state */}
      <div className="absolute top-16 right-4 z-20 flex flex-col items-end gap-2">
        {weekFilter !== null && (
          <div
            data-testid="map-week-focus-badge"
            className="flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-[#081523]/92 px-3 py-1.5 text-xs text-emerald-200 backdrop-blur-md"
          >
            <span className="font-mono-tabular">
              {t('mapPage.weekFocus', { year: selectedYear, week: weekFilter })}
            </span>
            <button
              type="button"
              onClick={onClearWeekFilter}
              aria-label={t('mapPage.clearWeek')}
              className="rounded p-0.5 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-[#081523]/92 px-3.5 py-2 text-xs font-medium text-emerald-200 backdrop-blur-md">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>{t('mapPage.loading')}</span>
          </div>
        ) : hotspots.length === 0 ? (
          <div
            data-testid="map-empty-state"
            className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-[#081523]/92 px-3.5 py-2 text-xs text-amber-200 backdrop-blur-md"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
            <span>{t('mapPage.noObservations', { year: selectedYear })}</span>
          </div>
        ) : null}
      </div>

      {/* Bottom-Left Intensity & Symbol Legend */}
      <div className="absolute bottom-4 left-4 z-20 w-56 rounded-xl border border-emerald-400/25 bg-[#081523]/90 px-3.5 py-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between text-xs font-medium text-white">
          <span className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400" aria-hidden="true" />
            <span>{t('mapPage.intensity')}</span>
          </span>
          <span className="font-mono-tabular text-[10px] text-slate-400">MW</span>
        </div>
        <div
          className="mt-2 h-2 w-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #fde047 0%, #f97316 55%, #ef4444 100%)',
          }}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
          <span>{t('mapPage.low')}</span>
          <span>{t('mapPage.high')}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-1.5 text-[10px] text-slate-300">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-sky-300 bg-orange-400" aria-hidden="true" />
            <span>MODIS</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-purple-300 bg-orange-400" aria-hidden="true" />
            <span>VIIRS</span>
          </span>
          <span className={dataMode === 'demo' ? 'font-mono-tabular font-semibold text-amber-300' : 'text-emerald-300'}>
            {dataMode === 'demo' ? t('mapPage.demo') : t('mapPage.real')}
          </span>
        </div>
      </div>

      {/* Bottom-Right Dynamic Scale Bar + Legal Attribution */}
      <div className="pointer-events-none absolute bottom-3.5 right-4 z-20 flex flex-col items-end gap-1.5">
        <div className="flex flex-col items-center rounded-md bg-[#040b14]/75 px-2 py-1 backdrop-blur-sm">
          <span className="font-mono-tabular text-xs font-medium text-slate-200">
            {scaleLabel}
          </span>
          <div className="mt-0.5 flex h-1.5 w-24 items-end border-x border-b border-slate-200/90" />
        </div>
        <div className="rounded bg-[#040b14]/75 px-1.5 py-0.5 text-[10px] text-slate-400">
          {BASEMAP_ATTRIBUTION}
        </div>
      </div>
    </div>
  );
}
