import { useFireLens } from '../state/FireLensContext';
import { FireMap } from '../components/FireMap';
import { TimelineBar } from '../components/TimelineBar';
import { RightAnalyticsPanel } from '../components/RightAnalyticsPanel';
import type { InfoTopic } from '../components/InfoModal';

interface MapPageProps {
  onOpenInfo: (topic: InfoTopic) => void;
  onOpenFilterModal: () => void;
}

export function MapPage({ onOpenInfo, onOpenFilterModal }: MapPageProps) {
  const {
    state,
    selectedRegion,
    activeRegionData,
    filteredHotspots,
    filteredAnnualSeries,
    dispatch,
    runAnalysis,
  } = useFireLens();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] items-start">
      {state.calendarMapSelection&&<div className="lg:col-span-2 firelens-panel rounded-xl p-3 text-sm flex flex-wrap justify-between gap-2"><span>{state.language==='ru'?'Период календаря':'Calendar period'}: {state.calendarMapSelection.start} → {state.calendarMapSelection.end} · {state.calendarMapSelection.mode==='matched'?(state.language==='ru'?'Сопоставленная подвыборка, дата группы по Aqua':'Matched subset, group date is Aqua UTC'):(state.language==='ru'?'Исходные QA-наблюдения выбранного сенсора':'Raw QA observations of selected sensor')}</span><button className="underline text-emerald-300" onClick={()=>dispatch({type:'SET_TAB',tab:'history'})}>{state.language==='ru'?'Вернуться к календарю':'Back to calendar'}</button></div>}
      <div className="flex flex-col gap-4">
        <FireMap
          regions={state.dataset.regions}
          selectedRegion={selectedRegion}
          hotspots={filteredHotspots}
          selectedYear={state.selectedYear}
          selectedObservation={state.selectedObservation}
          enabledSensors={state.enabledSensors}
          basemapTheme={state.basemapTheme}
          dateFrom={state.dateFrom}
          dateTo={state.dateTo}
          timeStartHour={state.timeStartHour}
          timeEndHour={state.timeEndHour}
          weekFilter={state.weekFilter}
          isLoading={state.isAnalyzing}
          dataMode={state.dataMode}
          onSelectRegion={(regionId) => dispatch({ type: 'SET_REGION', regionId })}
          onSelectObservation={(observation) =>
            dispatch({ type: 'SET_SELECTED_OBSERVATION', observation })
          }
          onToggleSensor={(sensor) => dispatch({ type: 'TOGGLE_SENSOR', sensor })}
          onChangeBasemapTheme={(theme) => dispatch({ type: 'SET_BASEMAP_THEME', theme })}
          onUpdateDateTimeFilter={(payload) =>
            dispatch({ type: 'SET_OBSERVATION_TIME_FILTER', ...payload })
          }
          onClearWeekFilter={() => dispatch({ type: 'SET_WEEK_FILTER', week: null })}
          onClearAllTimeFilters={() => dispatch({ type: 'CLEAR_OBSERVATION_FILTERS' })}
        />

        <TimelineBar
          minYear={state.selectedDateRange[0]}
          maxYear={state.selectedDateRange[1]}
          selectedYear={state.selectedYear}
          isPlaying={state.isPlaying}
          onSelectYear={(year) => dispatch({ type: 'SET_YEAR', year })}
          onTogglePlay={() => dispatch({ type: 'TOGGLE_PLAY' })}
        />
      </div>

      <RightAnalyticsPanel
        selectedDateRange={state.selectedDateRange}
        selectedYear={state.selectedYear}
        enabledSensors={state.enabledSensors}
        annualSeries={filteredAnnualSeries}
        harmonization={activeRegionData?.harmonization ?? null}
        filteredCount={filteredHotspots.length}
        dataMode={state.dataMode}
        isAnalyzing={state.isAnalyzing}
        hasAnalyzed={state.hasAnalyzed}
        onToggleSensor={(sensor) => dispatch({ type: 'TOGGLE_SENSOR', sensor })}
        onSelectPeriod={(start, end) =>
          dispatch({ type: 'SET_DATE_RANGE', range: [start, end] })
        }
        onOpenFilterModal={onOpenFilterModal}
        onRunAnalysis={runAnalysis}
        onSelectYear={(year) => dispatch({ type: 'SET_YEAR', year })}
        onOpenInfo={onOpenInfo}
      />
    </div>
  );
}
