import { Play, Pause } from 'lucide-react';
import { useFireLens } from '../state/FireLensContext';

interface TimelineBarProps {
  minYear: number;
  maxYear: number;
  selectedYear: number;
  isPlaying: boolean;
  onSelectYear: (year: number) => void;
  onTogglePlay: () => void;
}

export function TimelineBar({
  minYear,
  maxYear,
  selectedYear,
  isPlaying,
  onSelectYear,
  onTogglePlay,
}: TimelineBarProps) {
  const { t } = useFireLens();
  const span = Math.max(1, maxYear - minYear);
  const progressPct = Math.min(100, Math.max(0, ((selectedYear - minYear) / span) * 100));

  return (
    <section
      aria-label="Timeline observations bar"
      className="firelens-panel flex items-center gap-4 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5"
    >
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause yearly playback' : 'Play yearly playback'}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#67eb4d] bg-emerald-950/60 text-[#7df55e] shadow-[0_0_16px_rgba(103,235,77,0.3)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {isPlaying ? (
          <Pause className="h-4.5 w-4.5 fill-current" aria-hidden="true" />
        ) : (
          <Play className="h-4.5 w-4.5 translate-x-0.5 fill-current" aria-hidden="true" />
        )}
      </button>

      <div className="shrink-0">
        <div className="text-[10px] text-slate-400">{t('mapPage.yearSlice')}</div>
        <div>
          <span className="text-sm font-medium text-slate-300">{t('mapPage.yearLabel')} </span>
          <span
            className="font-mono-tabular text-base font-bold text-white"
            data-testid="selected-year-display"
          >
            {selectedYear}
          </span>
        </div>
      </div>

      <div className="relative flex-1 pt-5 pb-4">
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#8df552] to-[#39d353] px-2.5 py-0.5 font-mono-tabular text-xs font-bold text-[#041309] shadow-[0_0_12px_rgba(99,235,76,0.5)] transition-[left] duration-200"
          style={{ left: `${progressPct}%` }}
        >
          {selectedYear}
        </div>

        <div className="relative flex items-center">
          <div className="h-1.5 w-full rounded-full bg-slate-800/90">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#74f04d] shadow-[0_0_10px_rgba(116,240,77,0.55)] transition-[width] duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <input
            type="range"
            aria-label="Select observation year"
            min={minYear}
            max={maxYear}
            step={1}
            value={selectedYear}
            onChange={(e) => onSelectYear(Number(e.target.value))}
            className="firelens-slider absolute inset-0 h-6 w-full"
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between font-mono-tabular text-xs text-slate-400">
          <span>{minYear}</span>
          <span>{maxYear}</span>
        </div>
      </div>
    </section>
  );
}
