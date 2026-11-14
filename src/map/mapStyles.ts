import type { StyleSpecification } from 'maplibre-gl';
import type { MapBasemapMode } from '../state/FireLensContext';
import { NATURAL_EARTH_COUNTRIES } from './realGeoBoundaries';

export const OPENFREEMAP_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const OPENFREEMAP_STANDARD_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export const BASEMAP_ATTRIBUTION =
  '© OpenStreetMap contributors · OpenFreeMap · Esri World Imagery · OpenTopoMap';

export async function loadFireLensBasemapStyle(
  theme: MapBasemapMode = 'dark'
): Promise<StyleSpecification | string> {
  if (theme === 'satellite') {
    return {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Esri, Maxar, GeoEye, Earthstar Geographics',
        },
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };
  }

  if (theme === 'terrain') {
    return {
      version: 8,
      sources: {
        'opentopomap': {
          type: 'raster',
          tiles: [
            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
        },
      },
      layers: [
        {
          id: 'terrain-tiles',
          type: 'raster',
          source: 'opentopomap',
          minzoom: 0,
          maxzoom: 17,
        },
      ],
    };
  }

  const targetUrl =
    theme === 'standard' ? OPENFREEMAP_STANDARD_STYLE_URL : OPENFREEMAP_DARK_STYLE_URL;

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    const res = await fetch(targetUrl, { signal: controller.signal });
    window.clearTimeout(timeout);

    if (!res.ok) {
      return createNaturalEarthFallbackStyle(theme);
    }

    const style = (await res.json()) as StyleSpecification;
    if (!style || !Array.isArray(style.layers)) {
      return createNaturalEarthFallbackStyle(theme);
    }

    if (theme === 'standard') {
      return style;
    }

    // Subtly shift grayscale dark style toward deep space blue-black for FireLens cohesion
    const tunedLayers = style.layers.map((layer) => {
      if (layer.id === 'background' && layer.type === 'background') {
        return {
          ...layer,
          paint: {
            ...layer.paint,
            'background-color': '#06111e',
          },
        };
      }
      if (layer.id === 'water' && layer.type === 'fill') {
        return {
          ...layer,
          paint: {
            ...layer.paint,
            'fill-color': '#030b16',
          },
        };
      }
      if (layer.id === 'waterway' && layer.type === 'line') {
        return {
          ...layer,
          paint: {
            ...layer.paint,
            'line-color': '#081b33',
          },
        };
      }
      if (layer.id.includes('boundary') && layer.type === 'line') {
        return {
          ...layer,
          paint: {
            ...layer.paint,
            'line-color': 'rgba(148, 163, 184, 0.38)',
          },
        };
      }
      return layer;
    });

    return {
      ...style,
      layers: tunedLayers,
    };
  } catch {
    return createNaturalEarthFallbackStyle(theme);
  }
}

export function createNaturalEarthFallbackStyle(
  theme: MapBasemapMode = 'dark'
): StyleSpecification {
  const isStandard = theme === 'standard' || theme === 'terrain';
  return {
    version: 8,
    sources: {
      'ne-countries': {
        type: 'geojson',
        data: NATURAL_EARTH_COUNTRIES,
      },
    },
    layers: [
      {
        id: 'ne-ocean',
        type: 'background',
        paint: {
          'background-color': isStandard ? '#cbd5e1' : '#030b16',
        },
      },
      {
        id: 'ne-land',
        type: 'fill',
        source: 'ne-countries',
        paint: {
          'fill-color': isStandard ? '#f1f5f9' : '#0b1a26',
          'fill-opacity': 0.96,
        },
      },
      {
        id: 'ne-borders',
        type: 'line',
        source: 'ne-countries',
        paint: {
          'line-color': isStandard ? 'rgba(71, 85, 105, 0.45)' : 'rgba(148, 163, 184, 0.3)',
          'line-width': 1,
        },
      },
    ],
  };
}
