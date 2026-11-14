> Обновление 2026-11-14: контракт сохраняет совместимость полей, но импорт всегда сбрасывает `harmonization.verified` в `false`. Флаг пользователя не доказывает валидацию. Исторические режимы не разблокируются импортом. Шаблон JSON — синтетический DEMO, а не образец реальных данных. В этой поставке нет Python/FastAPI научного сервера: экспериментальный анализ реализован на TypeScript, API — Node.js. Остальные описания ниже относятся к исходному контракту.

# FireLens ↔ Python JSON Contract (`schemaVersion: "2.1.0"`)

Единый типизированный контракт данных между научным Python-пайплайном (FastAPI / CLI) и веб-приложением FireLens для задачи NASA Space Apps Challenge 2026 («Harmonization of MODIS and VIIRS Hot Spots»).

## 1. Принципы контракта

1. **Изоляция демонстрационных и реальных данных**: поле `dataMode` принимает строго `"demo"` или `"real"`. Пользовательские JSON-наборы от Python получают `dataMode: "real"`.
2. **Отсутствующие данные (`null` ≠ `0`)**: отсутствующие наблюдения или нерассчитанные метрики передаются как `null` со статусом `completenessStatus: "missing"` или `"partial"`. Никогда не заменяйте пропуски нулём.
3. **Раздельные шкалы достоверности**:
   - `MODIS`: `modisConfidencePct` (`0–100`, число) и `viirsConfidenceLevel: null`
   - `VIIRS`: `viirsConfidenceLevel` (`"low" | "nominal" | "high"`) и `modisConfidencePct: null`
4. **Научная валидация**: вкладки «Гармонизированная» (История) и «Гармонизированные» (Сравнение) разблокируются только при `harmonization.verified === true` и наличии ненулевых гармонизированных рядов.

## 2. Корневая структура `FireLensDataset`

| Поле | Тип | Описание |
|---|---|---|
| `schemaVersion` | `string` | Версия контракта (`"2.1.0"`) |
| `dataMode` | `"demo" \| "real"` | Режим источника (`"real"` для Python) |
| `sourceName` | `string` | Например, `"NASA FIRMS MODIS/VIIRS (Python Pipeline)"` |
| `generatedAt` | `string` | ISO-метка времени генерации UTC |
| `yearRange` | `[number, number]` | Диапазон лет, например `[2000, 2026]` |
| `provenance` | `DatasetProvenanceMetadata` | Источник, продукты NASA FIRMS, период, метод, ограничения |
| `sensors` | `Record<"MODIS" \| "VIIRS", SensorMetadata>` | Разрешение, спутники, шкалы достоверности |
| `regions` | `RegionDefinition[]` | Список регионов (`id`, `name`, `isoNumeric`, `center`, `bounds`) |
| `dataByRegion` | `Record<string, RegionDataset>` | Данные, агрегаты и валидация по каждому `region.id` |

## 3. Структура `RegionDataset`

### 3.1. Наблюдения NASA FIRMS (`hotspots: HotspotObservation[]`)

- `id`: `string`
- `regionId`: `string`
- `date`: `string` (`YYYY-MM-DD`, строгая ISO-валидация)
- `acqTimeUtc`: `string | null` (формат `"HH:MM"` UTC; адаптер также принимает сырое NASA FIRMS `acq_time` вроде `815` или `"0815"`)
- `dayNight`: `"D" | "N" | null`
- `year`, `month`, `week` (`1..52`)
- `lat`, `lng`: `number` (`[-90..90]`, `[-180..180]`)
- `sensor`: `"MODIS" | "VIIRS"`
- `frpMw`: `number >= 0`, `frpUnit: "MW"`
- `modisConfidencePct`: `number | null` (`0..100` только для MODIS)
- `viirsConfidenceLevel`: `"low" | "nominal" | "high" | null` (только для VIIRS)
- `intensity`: `number` (`0..1`)
- `harmonizedFrpMw`: `number | null` (опционально)

### 3.2. Годовые агрегаты (`annualSeries: AnnualObservationPoint[]`)

- `year`, `metricName`, `metricUnit`
- `modisCount`, `viirsCount`, `harmonizedCount`: `number | null`
- `harmonizedLowerCi`, `harmonizedUpperCi`: `number | null` (границы 95% ДИ)
- `modisMeanFrpMw`, `viirsMeanFrpMw`, `harmonizedMeanFrpMw`: `number | null`
- `completenessStatus`: `"complete" | "partial" | "missing"`
- `completenessNote`: `string` (опционально)

### 3.3. Недельный календарь и аномалии (`weeklyActivity: WeeklyActivityPoint[]`)

- `year`, `week` (`1..52`), `metricName`, `metricUnit`
- `modisCount`, `viirsCount`, `rawValue`, `harmonizedValue`: `number | null`
- `baselinePeriod`: `string | null` (например, `"2000–2020"`)
- `comparableSeriesLabel`: `string | null` (например, `"MODIS (1000 м)"` — аномалии вычисляются строго по сопоставимому ряду!)
- `historicalBaseline`, `anomalyValue`, `anomalyPct`: `number | null`
- `totalFrpMw`: `number | null`
- `completenessStatus`: `"complete" | "partial" | "missing"`

### 3.4. Результаты гармонизации и валидация (`harmonization: HarmonizationResult | null`)

- `verified`: `boolean`
- `metricName`, `metricUnit`
- `overlapPeriod`: `[number, number]` (например, `[2012, 2026]`)
- `calibrationPeriod`: `[number, number] | null` (например, `[2012, 2021]`)
- `beforeValue`, `afterValue`: `number | null`
- `methodName`, `methodVersion`, `methodologySummary`, `methodologySteps`, `limitations`
- `validation`:
  - `holdoutPeriod`: `string | null` (например, `"2022–2025 (holdout)"`)
  - `holdoutSampleSize`: `number | null`
  - `mae`, `rmse`, `bias`, `rSquared`: `number | null`
  - `confidenceInterval95`: `string | null`
  - `unit`: `string`

## 4. Минимальный пример экспорта из Python (FastAPI)

Актуальный эталонный JSON всегда можно скачать прямо из интерфейса кнопкой **«Шаблон JSON»** (вызывает `buildPythonJsonTemplate()` из `src/data/adapters/pythonJsonAdapter.ts`).
