# Live NASA connection — 2026-11-14

Configured the user-provided MAP_KEY only in the local Downloads/firelens/.env (ignored by git). No credentials are included in this delivery.

Verified health: firmsConfigured=true. Actual 5-day Area API requests for Kazakhstan bbox returned HTTP 200: MODIS_NRT 21 rows; VIIRS_SNPP_NRT 0; VIIRS_NOAA20_NRT 198; VIIRS_NOAA21_NRT 194.

UI now offers an explicit VIIRS satellite selector (default NOAA-20); sources are not silently pooled. Default recent interval is 5 days. After exact country-polygon filtering, MODIS + NOAA-20 yielded 111 observations (13 MODIS, 98 VIIRS), 108 outside-area records excluded, 0 rejected, 0 duplicates. The actual in-app browser confirmed 111 loaded points for 2026 and Real mode.

Analysis: 5 common occupied grid-cell/day pairs spanning 2 dates. Insufficient for independent chronological training/holdout; calibration=null. No scientific validation claimed.

Checks after changes: TypeScript PASS; 11/11 tests PASS; production build PASS (large-bundle warning remains). Real snapshots and analysis JSON are in examples/nasa-live-kazakhstan.json and examples/nasa-live-analysis.json.
