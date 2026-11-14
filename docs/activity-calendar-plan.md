# Real activity calendar 2024–2025

Approved scope: preserve FireLens design; monthly and seven-day views, separate Aqua and NOAA-20, separate experimental matched FRP, no invented baseline/anomaly/forecast.

1. Pure calendar aggregator: raw QA record counts and FRP per sensor; matched group sums (Aqua, frozen-scale Aqua, VIIRS); Jan-1 anchored 7-day periods including short W53; calendar-month periods. No raw MODIS+VIIRS fire total. Null when no records/groups; measured FRP=0 remains zero. Query-day completeness separate from actual satellite coverage.
2. Tests before implementation: leap/non-leap year tails, no dropped/double-counted boundary observations, sensor separation, zero vs missing, partial query windows, matched-only exclusion and frozen scaling, dataset replacement clears calendar.
3. Reproducible builder uses both eligible QA CSV files (full cohort, not matched subset), both matching group CSV files, archive manifests and frozen coefficient; writes dataset, calendar JSON, period CSV and audit. Independent Python verifies every period against CSV inputs.
4. History view: explicit real-case load, raw/matched switch, counts/FRP, months/weeks, per-period details, descriptive monthly profile, download JSON/CSV and exact-date jump to map. Anomalies/forecasts disabled. Existing demo history remains available only in DEMO and clearly labeled.
5. Install updated copy, run app type checks, meaningful tests, build and browser checks (months/weeks/matched/map reset), package data and instructions. Preserve local NASA key.

One calendar is for Kazakhstan's 2024/2025 QA cohort only. It describes detections, not unique fires, burned area or normalized historical activity. Experimental values are sums over jointly detected groups, not a correction of every raw record.
