/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SciencePanel } from './components/SciencePanel';
import { useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { FireLensProvider, useFireLens } from './state/FireLensContext';
import { TopNav } from './components/TopNav';
import { FilterAndJsonModal, InfoModal, type InfoTopic } from './components/InfoModal';
import { MapPage } from './pages/MapPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { HistoryPage } from './pages/HistoryPage';

function FireLensShell() {
  const {
    state,
    dispatch,
    uploadJsonFile,
    downloadJsonTemplate,
  } = useFireLens();

  const [infoTopic, setInfoTopic] = useState<InfoTopic | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  return (
    <div className="firelens-backdrop min-h-screen flex flex-col text-slate-100">
      <TopNav
        activeTab={state.activeTab}
        onSelectTab={(tab) => dispatch({ type: 'SET_TAB', tab })}
        onOpenInfo={(topic) => setInfoTopic(topic)}
        dataMode={state.dataMode}
        sourceName={state.dataset.sourceName}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <SciencePanel />
        <div className="h-4" />
        <AnimatePresence mode="wait">
          <motion.div
            key={state.activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {state.activeTab === 'map' && (
              <MapPage
                onOpenInfo={(topic) => setInfoTopic(topic)}
                onOpenFilterModal={() => setFilterModalOpen(true)}
              />
            )}
            {state.activeTab === 'analysis' && (
              <AnalysisPage onOpenInfo={(topic) => setInfoTopic(topic)} />
            )}
            {state.activeTab === 'comparison' && (
              <ComparisonPage onOpenInfo={(topic) => setInfoTopic(topic)} />
            )}
            {state.activeTab === 'history' && (
              <HistoryPage onOpenInfo={(topic) => setInfoTopic(topic)} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <InfoModal
        topic={infoTopic}
        onClose={() => setInfoTopic(null)}
        dataMode={state.dataMode}
        provenance={state.dataset.provenance}
        sensors={state.dataset.sensors}
      />

      <FilterAndJsonModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        selectedYear={state.selectedYear}
        minIntensity={state.minIntensity}
        dateFrom={state.dateFrom}
        dateTo={state.dateTo}
        timeStartHour={state.timeStartHour}
        timeEndHour={state.timeEndHour}
        onUpdateMinIntensity={(value) => dispatch({ type: 'SET_MIN_INTENSITY', value })}
        onUpdateDateTimeFilter={(payload) =>
          dispatch({ type: 'SET_OBSERVATION_TIME_FILTER', ...payload })
        }
        onClearTimeFilters={() => dispatch({ type: 'CLEAR_OBSERVATION_FILTERS' })}
        onUploadJsonFile={async (file) => {
          const ok = await uploadJsonFile(file);
          if (ok) setFilterModalOpen(false);
        }}
        onDownloadTemplate={downloadJsonTemplate}
        onResetToDemo={() => dispatch({ type: 'RESET_TO_DEMO' })}
        dataMode={state.dataMode}
        uploadError={state.uploadError}
      />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <FireLensProvider>
        <FireLensShell />
      </FireLensProvider>
    </MotionConfig>
  );
}
