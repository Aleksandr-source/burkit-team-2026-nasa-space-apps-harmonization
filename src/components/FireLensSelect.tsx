import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FireLensSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface FireLensSelectProps {
  value: string;
  options: FireLensSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  icon?: ReactNode;
  mono?: boolean;
  className?: string;
  menuClassName?: string;
  variant?: 'map' | 'panel';
}

export function FireLensSelect({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  mono = false,
  className = '',
  menuClassName = '',
  variant = 'panel',
}: FireLensSelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      setFocusedIndex((prev) => {
        const base = prev >= 0 ? prev : Math.max(0, selectedIndex);
        return e.key === 'ArrowDown'
          ? (base + 1) % options.length
          : (base - 1 + options.length) % options.length;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (open && focusedIndex >= 0 && options[focusedIndex]) {
        e.preventDefault();
        onChange(options[focusedIndex].value);
        setOpen(false);
      }
    }
  };

  const triggerBase =
    variant === 'map'
      ? 'bg-[#081523]/92 backdrop-blur-md shadow-lg border-emerald-400/35 hover:border-emerald-400/65'
      : 'bg-[#0b1829]/88 backdrop-blur-md border-slate-700/80 hover:border-emerald-400/55';

  const triggerOpen = open
    ? 'border-emerald-400/80 shadow-[0_0_18px_rgba(74,222,128,0.18)] ring-1 ring-emerald-400/30'
    : '';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
            return next;
          });
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2.5 rounded-xl border py-2.5 pl-3 pr-2.5 text-left text-sm text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer ${triggerBase} ${triggerOpen}`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {icon && <span className="shrink-0">{icon}</span>}
          <span
            className={`truncate ${
              mono ? 'font-mono-tabular' : 'font-medium'
            }`}
          >
            {selectedOption?.label ?? '—'}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-300 transition-transform duration-150 ${
            open ? 'rotate-180 text-[#6ee755]' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 top-full z-50 mt-1.5 min-w-full w-max max-w-[280px] overflow-hidden rounded-xl border border-emerald-400/35 bg-[#071322]/98 p-1.5 shadow-[0_16px_38px_rgba(0,0,0,0.78),0_0_20px_rgba(16,185,129,0.14)] backdrop-blur-xl ${menuClassName}`}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/85 text-emerald-200 border border-emerald-400/40 font-semibold'
                      : isFocused
                        ? 'bg-slate-800/75 text-white border border-transparent'
                        : 'text-slate-200 hover:bg-slate-800/60 hover:text-white border border-transparent'
                  }`}
                >
                  <span className={`truncate ${mono ? 'font-mono-tabular text-[13px]' : ''}`}>
                    {opt.label}
                  </span>
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#6ee755]" aria-hidden="true" />
                  ) : opt.hint ? (
                    <span className="shrink-0 text-[10px] text-slate-400">{opt.hint}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
