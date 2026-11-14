import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPythonJsonTemplate,
  computeMapScaleLabel,
  computeObservationSummary,
  filterAnnualSeries,
  filterHotspots,
  hotspotsToGeoJson,
  loadDemoDataset,
  parseAndValidateFireLensJson,
} from './pythonJsonAdapter';
import { buildAnomalyExplanation } from '../anomalyExplainer';
import { createInitialFireLensState, fireLensReducer } from '../../state/FireLensContext';
import {
  getRegionBoundaryGeoJson,
  hasVerifiedRegionBoundary,
  isPointInRegionLand,
} from '../../map/realGeoBoundaries';

test('demo dataset uses Natural Earth Kazakhstan ISO 398, sensor-native confidence, honest null harmonization, and future 2026 missing weeks', () => {
  const demo = loadDemoDataset();
  assert.equal(demo.dataMode, 'demo');
  assert.ok(demo.provenance.sourceName.includes('DEMO'));
  assert.equal(demo.provenance.processingMethod, null);

  const kzMeta = demo.regions.find((r) => r.id === 'kazakhstan');
  assert.ok(kzMeta);
  assert.equal(kzMeta.isoNumeric, '398');

  const kzBoundary = getRegionBoundaryGeoJson(kzMeta);
  assert.equal(kzBoundary.features.length, 1);
  assert.equal(kzBoundary.features[0]?.properties?.isCountryBoundary, true);

  const kz = demo.dataByRegion['kazakhstan'];
  assert.ok(kz);
  assert.equal(kz.harmonization, null);
  assert.equal(kz.annualSeries.length, 27);

  // Verify sensor confidence scales and acquisition times
  const modisSpots = kz.hotspots.filter((s) => s.sensor === 'MODIS');
  const viirsSpots = kz.hotspots.filter((s) => s.sensor === 'VIIRS');
  assert.ok(modisSpots.length > 0);
  assert.ok(viirsSpots.length > 0);
  assert.ok(modisSpots.every((s) => s.modisConfidencePct !== null && s.viirsConfidenceLevel === null));
  assert.ok(viirsSpots.every((s) => s.viirsConfidenceLevel !== null && s.modisConfidencePct === null));
  assert.ok(kz.hotspots.every((s) => typeof s.acqTimeUtc === 'string' && /^\d{2}:\d{2}$/.test(s.acqTimeUtc)));

  // Verify missing weeks (pre-archive 2000 & future 2026 W47-W52) are explicitly 'missing' rather than zero
  const missingWeek2000 = kz.weeklyActivity.find((w) => w.year === 2000 && w.week === 1);
  assert.ok(missingWeek2000);
  assert.equal(missingWeek2000.completenessStatus, 'missing');
  assert.equal(missingWeek2000.rawValue, null);

  const futureWeek2026 = kz.weeklyActivity.find((w) => w.year === 2026 && w.week === 48);
  assert.ok(futureWeek2026);
  assert.equal(futureWeek2026.completenessStatus, 'missing');
  assert.equal(futureWeek2026.rawValue, null);
  assert.equal(futureWeek2026.comparableSeriesLabel, 'MODIS (1000 м)');
});

test('pythonJsonAdapter validates v2.1.0 structure, acq_time normalization, validation metrics, and rejects invalid inputs', () => {
  const validJson = buildPythonJsonTemplate();
  const okOutcome = parseAndValidateFireLensJson(validJson);
  assert.equal(okOutcome.ok, true);
  if (okOutcome.ok) {
    assert.equal(okOutcome.dataset.dataMode, 'demo');
    assert.ok(okOutcome.dataset.provenance.sourceName.includes('DEMO'));
    const spot = okOutcome.dataset.dataByRegion['kazakhstan']?.hotspots[0];
    assert.equal(spot?.acqTimeUtc, '08:15');
    const harm = okOutcome.dataset.dataByRegion['kazakhstan']?.harmonization;
    assert.equal(harm, null);
    assert.equal(okOutcome.dataset.dataMode, 'demo');
  }

  // Raw NASA FIRMS numeric acq_time (e.g. 815 -> "08:15")
  const firmsRawTimeJson = JSON.stringify({
    yearRange: [2020, 2022],
    regions: [{ id: 'kazakhstan', name: 'Казахстан', center: [66.9, 48.0] }],
    dataByRegion: {
      kazakhstan: {
        hotspots: [
          {
            id: 'f1',
            date: '2021-07-24',
            acq_time: 815,
            lat: 48.0,
            lng: 66.0,
            sensor: 'MODIS',
            frpMw: 31.2,
          },
        ],
      },
    },
  });
  const firmsOutcome = parseAndValidateFireLensJson(firmsRawTimeJson);
  assert.equal(firmsOutcome.ok, true);
  if (firmsOutcome.ok) {
    assert.equal(firmsOutcome.dataset.dataByRegion['kazakhstan']?.hotspots[0]?.acqTimeUtc, '08:15');
  }

  assert.equal(parseAndValidateFireLensJson('').ok, false);
  assert.equal(parseAndValidateFireLensJson('{ bad').ok, false);

  // Invalid ISO date (Feb 30)
  const badDateJson = JSON.stringify({
    yearRange: [2000, 2026],
    regions: [{ id: 'kazakhstan', name: 'Казахстан', center: [66.9, 48.0] }],
    dataByRegion: {
      kazakhstan: {
        hotspots: [
          {
            id: 'x1',
            date: '2021-02-30',
            lat: 48.0,
            lng: 66.0,
            sensor: 'MODIS',
            frpMw: 20,
          },
        ],
      },
    },
  });
  assert.equal(parseAndValidateFireLensJson(badDateJson).ok, false);

  // Out of bounds coordinate
  const badCoordJson = JSON.stringify({
    yearRange: [2000, 2026],
    regions: [{ id: 'kazakhstan', name: 'Казахстан', center: [66.9, 48.0] }],
    dataByRegion: {
      kazakhstan: {
        hotspots: [
          {
            id: 'x2',
            date: '2021-07-10',
            lat: 120.0,
            lng: 66.0,
            sensor: 'VIIRS',
            frpMw: 20,
          },
        ],
      },
    },
  });
  assert.equal(parseAndValidateFireLensJson(badCoordJson).ok, false);
});

test('fireLensReducer enforces scientific gating, Evidence Mode preservation, and basemap theme', () => {
  let state = createInitialFireLensState();
  assert.equal(state.selectedYear, 2021);
  assert.equal(state.selectedWeek, 30);
  assert.equal(state.historyMetricMode, 'raw');
  assert.equal(state.comparisonMode, 'raw');
  assert.equal(state.basemapTheme, 'dark');
  assert.equal(state.selectedRegionId, 'kazakhstan');

  // Scientific gating: block unverified harmonized modes in demo mode
  state = fireLensReducer(state, { type: 'SET_HISTORY_METRIC_MODE', mode: 'harmonized' });
  assert.equal(state.historyMetricMode, 'raw');
  state = fireLensReducer(state, { type: 'SET_COMPARISON_MODE', mode: 'harmonized' });
  assert.equal(state.comparisonMode, 'raw');

  state = fireLensReducer(state, { type: 'SET_BASEMAP_THEME', theme: 'standard' });
  assert.equal(state.basemapTheme, 'standard');

  state = fireLensReducer(state, { type: 'SET_YEAR', year: 2015 });
  assert.equal(state.selectedYear, 2015);

  state = fireLensReducer(state, { type: 'SET_WEEK', week: 18 });
  assert.equal(state.selectedWeek, 18);

  state = fireLensReducer(state, {
    type: 'JUMP_TO_PERIOD_ON_MAP',
    year: 2022,
    week: 34,
    filterByWeek: true,
  });
  assert.equal(state.activeTab, 'map');
  assert.equal(state.selectedYear, 2022);
  assert.equal(state.selectedWeek, 34);
  assert.equal(state.weekFilter, 34);

  // Evidence Mode transitions preserve region, year, and week
  state = fireLensReducer(state, { type: 'GO_TO_EVIDENCE_STEP', tab: 'analysis' });
  assert.equal(state.activeTab, 'analysis');
  assert.equal(state.selectedRegionId, 'kazakhstan');
  assert.equal(state.selectedYear, 2022);
  assert.equal(state.selectedWeek, 34);

  state = fireLensReducer(state, { type: 'GO_TO_EVIDENCE_STEP', tab: 'comparison' });
  assert.equal(state.activeTab, 'comparison');
  assert.equal(state.selectedYear, 2022);
  assert.equal(state.selectedWeek, 34);

  // A synthetic schema example cannot unlock scientific results.
  const realOutcome = parseAndValidateFireLensJson(buildPythonJsonTemplate());
  assert.equal(realOutcome.ok, true);
  if (realOutcome.ok) {
    state = fireLensReducer(state, {
      type: 'LOAD_DATASET_SUCCESS',
      dataset: realOutcome.dataset,
    });
    state = fireLensReducer(state, { type: 'SET_COMPARISON_MODE', mode: 'harmonized' });
    assert.equal(state.comparisonMode, 'raw');
    state = fireLensReducer(state, { type: 'SET_HISTORY_METRIC_MODE', mode: 'harmonized' });
    assert.equal(state.historyMetricMode, 'raw');
  }
});

test('filterHotspots and computeObservationSummary synchronize across date, time UTC, and week filters', () => {
  const demo = loadDemoDataset();
  const kz = demo.dataByRegion['kazakhstan'];
  const baseQuery = {
    regionId: 'kazakhstan',
    startYear: 2012,
    endYear: 2026,
    selectedYear: 2021,
    enabledSensors: { MODIS: true, VIIRS: false },
    minIntensity: 0,
  };

  const summary = computeObservationSummary(kz, baseQuery);
  assert.ok(summary.modisFilteredCount > 0);
  assert.equal(summary.viirsFilteredCount, 0);
  assert.equal(summary.annualViirsAggregate, null);
  assert.equal(summary.frpSampleSize, summary.modisFilteredCount);

  const geo = hotspotsToGeoJson(filterHotspots(kz, baseQuery, 'singleYear'));
  assert.equal(geo.features.length, summary.modisFilteredCount);
  assert.equal(filterAnnualSeries(kz, 2012, 2026).length, 15);
  assert.match(computeMapScaleLabel(4.2, 48), /^\d+\sкм$/);

  // Time-of-day UTC partition (day 04..16 vs night 16..04 must sum to full sample)
  const daySummary = computeObservationSummary(kz, {
    ...baseQuery,
    timeStartHour: 4,
    timeEndHour: 16,
  });
  const nightSummary = computeObservationSummary(kz, {
    ...baseQuery,
    timeStartHour: 16,
    timeEndHour: 4,
  });
  assert.equal(daySummary.totalFilteredCount + nightSummary.totalFilteredCount, summary.totalFilteredCount);

  // Date window filtering narrows sample
  const julySummary = computeObservationSummary(kz, {
    ...baseQuery,
    dateFrom: '2021-07-01',
    dateTo: '2021-07-31',
  });
  assert.ok(julySummary.totalFilteredCount <= summary.totalFilteredCount);
  assert.equal(julySummary.frpSampleSize, julySummary.totalFilteredCount);
});

test('buildAnomalyExplanation produces honest 5-part explanation without fabricated causes', () => {
  const demo = loadDemoDataset();
  const kzRegion = demo.regions.find((r) => r.id === 'kazakhstan')!;
  const kzData = demo.dataByRegion['kazakhstan']!;

  const peakWeek = kzData.weeklyActivity.find((w) => w.year === 2021 && w.week === 30)!;
  const demoExpl = buildAnomalyExplanation({
    region: kzRegion,
    record: peakWeek,
    harmonization: kzData.harmonization,
    enabledSensors: { MODIS: true, VIIRS: true },
    dataMode: 'demo',
  });
  assert.equal(demoExpl.canDrawFullConclusion, false);
  assert.ok(demoExpl.whatHappened.includes('тепловых детекций'));
  assert.ok(demoExpl.deviationFromNorm.includes('MODIS'));
  assert.ok(demoExpl.reliability.includes('DEMO'));
  assert.ok(demoExpl.limitations.includes('не подтверждают причину'));

  const missingWeek = kzData.weeklyActivity.find((w) => w.year === 2026 && w.week === 49)!;
  const missingExpl = buildAnomalyExplanation({
    region: kzRegion,
    record: missingWeek,
    harmonization: null,
    enabledSensors: { MODIS: true, VIIRS: true },
    dataMode: 'demo',
  });
  assert.equal(missingExpl.canDrawFullConclusion, false);
  assert.ok(missingExpl.whatHappened.includes('отсутствуют'));

  // A schema example does not establish scientific validity.
  const realOutcome = parseAndValidateFireLensJson(buildPythonJsonTemplate());
  assert.equal(realOutcome.ok, true);
  if (realOutcome.ok) {
    const realKz = realOutcome.dataset.dataByRegion['kazakhstan']!;
    const realExpl = buildAnomalyExplanation({
      region: realOutcome.dataset.regions[0]!,
      record: realKz.weeklyActivity[0]!,
      harmonization: realKz.harmonization,
      enabledSensors: { MODIS: true, VIIRS: true },
      dataMode: 'real',
    });
    assert.equal(realExpl.canDrawFullConclusion, false);
    assert.equal(realKz.harmonization, null);
  }
});

test('every region has accurate boundaries (no fake bounding-box rectangles) and region-isolated land hotspots', () => {
  const demo = loadDemoDataset();

  for (const region of demo.regions) {
    const boundary = getRegionBoundaryGeoJson(region);
    const regionData = demo.dataByRegion[region.id];
    assert.ok(regionData, `Missing region data for ${region.id}`);

    if (region.id === 'kazakhstan' || region.id === 'california') {
      assert.equal(hasVerifiedRegionBoundary(region), true);
      assert.equal(boundary.features.length, 1);
      assert.equal(boundary.features[0]?.properties?.isVerifiedBoundary, true);
    } else {
      // Informal study areas (Siberia, Amazonia, SE Australia, Kamchatka) MUST NOT render bounding boxes
      assert.equal(hasVerifiedRegionBoundary(region), false);
      assert.equal(boundary.features.length, 0);
    }

    if (region.id === 'kamchatka') {
      assert.equal(regionData.hotspots.length, 0);
      assert.equal(regionData.annualSeries.length, 0);
      assert.equal(regionData.weeklyActivity.length, 0);
    } else {
      assert.ok(regionData.hotspots.length > 0, `${region.id} should have demo hotspots`);
      for (const spot of regionData.hotspots) {
        assert.equal(spot.regionId, region.id);
        assert.equal(
          isPointInRegionLand(region.id, region.bounds, spot.lng, spot.lat),
          true,
          `Hotspot ${spot.id} (${spot.lng}, ${spot.lat}) fell outside valid land/boundary of ${region.id}`
        );
      }
    }
  }

  // Cross-region & out-of-bounds hotspots must be rejected by filterHotspots
  const kzRegion = demo.regions.find((r) => r.id === 'kazakhstan')!;
  const kzData = demo.dataByRegion['kazakhstan']!;
  const auSpot = demo.dataByRegion['australia']!.hotspots.find((h) => h.year === 2021)!;
  const contaminated = {
    ...kzData,
    hotspots: [
      ...kzData.hotspots,
      { ...auSpot, id: 'leaked-au-1' },
      { ...kzData.hotspots[0]!, id: 'out-of-bounds-1', year: 2021, lng: 149.5, lat: -33.0 },
    ],
  };

  const clean = filterHotspots(kzData, {
    regionId: 'kazakhstan',
    regionBounds: kzRegion.bounds,
    startYear: 2000,
    endYear: 2026,
    selectedYear: 2021,
    enabledSensors: { MODIS: true, VIIRS: true },
    minIntensity: 0,
  });
  const filtered = filterHotspots(contaminated, {
    regionId: 'kazakhstan',
    regionBounds: kzRegion.bounds,
    startYear: 2000,
    endYear: 2026,
    selectedYear: 2021,
    enabledSensors: { MODIS: true, VIIRS: true },
    minIntensity: 0,
  });
  assert.equal(filtered.length, clean.length);
  assert.equal(filtered.some((h) => h.id === 'leaked-au-1' || h.id === 'out-of-bounds-1'), false);
});

