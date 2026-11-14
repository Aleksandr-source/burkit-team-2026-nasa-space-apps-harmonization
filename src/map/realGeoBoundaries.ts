import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type {
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  Position,
} from 'geojson';
import countries50m from 'world-atlas/countries-50m.json';
import land50m from 'world-atlas/land-50m.json';
import states10m from 'us-atlas/states-10m.json';
import type { GeoBounds, RegionDefinition } from '../types/firelens';

type WorldTopology = Topology<{
  countries: GeometryCollection<{ name?: string }>;
}>;

type LandTopology = Topology<{
  land: GeometryCollection<Record<string, never>>;
}>;

type UsStatesTopology = Topology<{
  states: GeometryCollection<{ name?: string }>;
}>;

const countriesTopo = countries50m as unknown as WorldTopology;
const countriesGeoJson = feature(
  countriesTopo,
  countriesTopo.objects.countries
) as FeatureCollection<Geometry, { name?: string }>;

const landTopo = land50m as unknown as LandTopology;
const landGeoJson = feature(landTopo, landTopo.objects.land) as FeatureCollection<
  Geometry,
  Record<string, never>
>;

const statesTopo = states10m as unknown as UsStatesTopology;
const usStatesGeoJson = feature(
  statesTopo,
  statesTopo.objects.states
) as FeatureCollection<Geometry, { name?: string }>;

export const NATURAL_EARTH_COUNTRIES: FeatureCollection<Geometry, { name?: string }> =
  countriesGeoJson;

/**
 * Returns all world countries from world-atlas for universal country selection.
 */
export function getAllWorldCountries(): { id: string; name: string; isoNumeric: string }[] {
  const list: { id: string; name: string; isoNumeric: string }[] = [];
  for (const f of countriesGeoJson.features) {
    const name = f.properties?.name;
    const iso = f.id ? String(f.id) : '';
    if (name && iso) {
      list.push({
        id: `country-${iso}`,
        name: String(name),
        isoNumeric: iso,
      });
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function isPointInRing(lng: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInPolygonCoords(lng: number, lat: number, rings: Position[][]): boolean {
  if (rings.length === 0 || !isPointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

export function isPointInGeometry(lng: number, lat: number, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') {
    return isPointInPolygonCoords(lng, lat, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly) => isPointInPolygonCoords(lng, lat, poly));
  }
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.some((g) => isPointInGeometry(lng, lat, g));
  }
  return false;
}

function findVerifiedRegionFeature(region: RegionDefinition) {
  if (region.isoNumeric) {
    const match = countriesGeoJson.features.find(
      (f) => String(f.id) === region.isoNumeric
    );
    if (match) {
      return { feature: match, isCountryBoundary: true };
    }
  }

  if (region.usStateFips) {
    const stateMatch = usStatesGeoJson.features.find(
      (f) => String(f.id) === region.usStateFips
    );
    if (stateMatch) {
      return { feature: stateMatch, isCountryBoundary: false };
    }
  }

  return null;
}

export function hasVerifiedRegionBoundary(region: RegionDefinition): boolean {
  return Boolean(region.customGeometry) || findVerifiedRegionFeature(region) !== null;
}

export function getRegionBoundaryGeoJson(
  region: RegionDefinition
): FeatureCollection<Geometry, GeoJsonProperties> {
  if (region.customGeometry) return {type:'FeatureCollection', features:[{type:'Feature', properties:{name:region.name, userSupplied:true}, geometry:region.customGeometry}]};
  const verified = findVerifiedRegionFeature(region);
  if (!verified) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: region.id,
        properties: {
          id: region.id,
          name: region.name,
          isCountryBoundary: verified.isCountryBoundary,
          isVerifiedBoundary: true,
        },
        geometry: verified.feature.geometry,
      },
    ],
  };
}

export function isPointInRegionLand(
  regionId: string,
  bounds: GeoBounds,
  lng: number,
  lat: number
): boolean {
  if (lng < bounds.west || lng > bounds.east || lat < bounds.south || lat > bounds.north) {
    return false;
  }

  if (regionId === 'kazakhstan') {
    const kz = countriesGeoJson.features.find((f) => String(f.id) === '398');
    return kz ? isPointInGeometry(lng, lat, kz.geometry) : true;
  }

  if (regionId === 'california') {
    const ca = usStatesGeoJson.features.find((f) => String(f.id) === '06');
    return ca ? isPointInGeometry(lng, lat, ca.geometry) : true;
  }

  if (regionId === 'australia') {
    const au = countriesGeoJson.features.find((f) => String(f.id) === '036');
    return au ? isPointInGeometry(lng, lat, au.geometry) : true;
  }

  if (regionId === 'siberia') {
    const ru = countriesGeoJson.features.find((f) => String(f.id) === '643');
    return ru ? isPointInGeometry(lng, lat, ru.geometry) : true;
  }

  // Check if matches any ISO country feature if custom country
  const customIsoMatch = regionId.startsWith('country-') ? regionId.replace('country-', '') : null;
  if (customIsoMatch) {
    const feat = countriesGeoJson.features.find((f) => String(f.id) === customIsoMatch);
    if (feat) {
      return isPointInGeometry(lng, lat, feat.geometry);
    }
  }

  return landGeoJson.features.some((f) => isPointInGeometry(lng, lat, f.geometry));
}

export function geometryBounds(geometry: Geometry): GeoBounds {
  const points: number[][] = [];
  function walk(value: unknown) { if (!Array.isArray(value)) return; if (typeof value[0] === 'number') {if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || Math.abs(value[0])>180 || Math.abs(value[1])>90) throw new Error('Invalid coordinates'); points.push(value as number[]);} else value.forEach(walk); }
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') throw new Error('Polygon / MultiPolygon required');
  walk(geometry.coordinates); if (points.length < 4) throw new Error('Empty polygon');
  return {west:Math.min(...points.map(p=>p[0])),east:Math.max(...points.map(p=>p[0])),south:Math.min(...points.map(p=>p[1])),north:Math.max(...points.map(p=>p[1]))};
}
export function countryBounds(iso: string): GeoBounds {
  const f = countriesGeoJson.features.find(f=>String(f.id)===iso);
  if (!f) throw new Error('Unknown country'); return geometryBounds(f.geometry);
}
