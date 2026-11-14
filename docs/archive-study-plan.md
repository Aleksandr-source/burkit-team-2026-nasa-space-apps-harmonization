# Kazakhstan 2024 study

1. Download full-year MODIS_SP and VIIRS_NOAA20_SP from official Area API, five days per request, exact adjacent windows, immutable raw files plus SHA-256 manifest; no credentials in artifacts.
2. Verify all 366 days requested for each sensor, header/record integrity and dates; geographic bbox then Natural Earth Kazakhstan polygon clipping; deduplicate by satellite/time/coordinates.
3. Primary cohort: NASA type=0 (presumed vegetation fire), MODIS confidence >=30, VIIRS nominal/high. Preserve original type and source. Report all exclusions; this does not establish actual wildfire causes or coverage.
4. Fixed 0.25-degree / UTC-day aggregation and OLS through origin, first 70% of paired dates training and last 30% holdout. Compare against identity mapping and a training-only mean-reference baseline. Keep holdout untouched by tuning.
5. Report sensitivity to low-confidence inclusion and type filtering descriptively, not use it to select a winning method. Export exact paired bins/predictions, statistics and plots. No zero-fill of non-detections, coverage or burned-area inference.
6. Expose a separately labeled reproducible real-data case in FireLens, retain DEMO separation and block scientific-validation claims. Tests and production build before packaging.

Decisions: NOAA-20 only for VIIRS; standard-processing historical products, not NRT; default method inherited from the prototype, not optimized on the holdout. Country boundary is cartographic/generalized. Same-year holdout is not independent ground-truth or cross-year validation.
