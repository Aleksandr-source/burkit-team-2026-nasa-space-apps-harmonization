import { Flame, Map as MapIcon, BarChart3, Layers, History, Info, Sun, Moon, Globe } from 'lucide-react';
import type { DataMode, NavTab } from '../types/firelens';
import { useFireLens } from '../state/FireLensContext';

interface TopNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenInfo: (topic: 'overview') => void;
  dataMode: DataMode;
  sourceName: string;
}

export function TopNav({
  activeTab,
  onSelectTab,
  onOpenInfo,
  dataMode,
  sourceName,
}: TopNavProps) {
  const { state, dispatch, t } = useFireLens();
  const isDemo = dataMode === 'demo';

  const NAV_ITEMS: { id: NavTab; labelKey: string; icon: typeof MapIcon }[] = [
    { id: 'map', labelKey: 'tabs.map', icon: MapIcon },
    { id: 'analysis', labelKey: 'tabs.analysis', icon: BarChart3 },
    { id: 'comparison', labelKey: 'tabs.comparison', icon: Layers },
    { id: 'history', labelKey: 'tabs.history', icon: History },
  ];

  const toggleLanguage = () => {
    dispatch({ type: 'SET_LANGUAGE', language: state.language === 'en' ? 'ru' : 'en' });
  };

  const toggleSiteTheme = () => {
    dispatch({ type: 'SET_SITE_THEME', theme: state.siteTheme === 'dark' ? 'light' : 'dark' });
  };

  return (
    <header className="w-full border-b border-emerald-400/15 bg-[#050d17]/90 dark:bg-[#050d17]/90 light:bg-slate-100/90 light:border-slate-300 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        {/* Zone 1: Brand + Challenge descriptor */}
        <div className="flex items-center gap-3.5 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab('map')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-lg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 shadow-[0_0_16px_rgba(249,115,22,0.45)]">
              <Flame className="h-4.5 w-4.5 text-white fill-white/80" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-white dark:text-white light:text-slate-900 whitespace-nowrap">
              FireLens
            </span>
          </button>

          <span className="hidden h-5 w-px bg-slate-700/70 light:bg-slate-300 sm:inline-block" aria-hidden="true" />

          <span className="hidden text-xs font-medium text-slate-300 dark:text-slate-300 light:text-slate-600 sm:inline-block whitespace-nowrap">
            {t('brandSubtitle')}
          </span>
        </div>

        {/* Zone 2: Primary Navigation Tabs */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-2 lg:gap-4"
        >
          {NAV_ITEMS.map(({ id, labelKey, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                  isActive
                    ? 'border border-emerald-400/80 bg-emerald-950/60 dark:bg-emerald-950/60 light:bg-emerald-100 text-emerald-300 dark:text-emerald-300 light:text-emerald-800 shadow-[0_0_16px_rgba(52,211,153,0.22)]'
                    : 'border border-transparent text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-white dark:hover:text-white light:hover:text-slate-900 hover:bg-slate-800/50 light:hover:bg-slate-200/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Data provenance label + Lang / Theme / Info */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span
            className={`hidden lg:inline-block max-w-[200px] truncate text-xs font-medium ${
              isDemo ? 'text-amber-300 dark:text-amber-300 light:text-amber-700' : 'text-emerald-300 dark:text-emerald-300 light:text-emerald-700'
            }`}
            title={isDemo ? t('demoData') : sourceName}
            data-testid="data-provenance-label"
          >
            {isDemo ? t('demoData') : sourceName}
          </span>

          {/* Language Switcher EN / RU */}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label="Toggle language"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 bg-slate-900/70 dark:bg-slate-900/70 light:bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-200 dark:text-slate-200 light:text-slate-800 transition-colors hover:border-emerald-400/60 hover:text-emerald-300"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span className="uppercase">{state.language}</span>
          </button>

          {/* Theme Toggle Sun / Moon */}
          <button
            type="button"
            onClick={toggleSiteTheme}
            aria-label="Toggle site theme"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 bg-slate-900/70 dark:bg-slate-900/70 light:bg-white text-slate-200 dark:text-slate-200 light:text-slate-800 transition-colors hover:border-emerald-400/60 hover:text-emerald-300"
          >
            {state.siteTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenInfo('overview')}
            aria-label={t('helpTooltip')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700/80 dark:border-slate-700/80 light:border-slate-300 bg-slate-900/70 dark:bg-slate-900/70 light:bg-white text-slate-200 dark:text-slate-200 light:text-slate-800 transition-colors hover:border-emerald-400/60 hover:text-emerald-300"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile compact navigation row */}
      <div className="flex items-center justify-between gap-1 border-t border-slate-800/70 light:border-slate-300 px-3 py-1.5 md:hidden">
        <nav aria-label="Mobile navigation" className="grid w-full grid-cols-4 gap-1">
          {NAV_ITEMS.map(({ id, labelKey, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border border-emerald-400/75 bg-emerald-950/60 dark:bg-emerald-950/60 light:bg-emerald-100 text-emerald-300 dark:text-emerald-300 light:text-emerald-800'
                    : 'text-slate-300 dark:text-slate-300 light:text-slate-700 hover:text-white dark:hover:text-white light:hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{t(labelKey)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
