import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, XCircle, CheckCircle, RefreshCw } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useQueryState } from '../contexts/QueryStateContext'
import { useCycleDiscoveryWorker } from '../hooks/useCycleDiscoveryWorker'
import CycleDiscoverySearch from '../components/CycleDiscoverySearch'
import CycleResultsTable from '../components/CycleResultsTable'
import CycleVisualization from '../components/CycleVisualization'
import type {
  CycleDiscoveryParameters,
  CycleDiscoveryResults,
  DiscoveredCycle,
} from '../types'

const DEFAULT_PARAMS: CycleDiscoveryParameters = {
  minFusionMeV: 1.0,
  minTwoToTwoMeV: 0.5,
  maxCycleDepth: 6,
  includeFission: false,
  maxCycles: 100,
}

export default function CycleDiscovery() {
  const { t } = useTranslation()
  const { db } = useDatabase()
  const navigate = useNavigate()
  const {
    runDiscovery,
    cancelDiscovery,
    progress,
    isRunning,
    error: workerError,
  } = useCycleDiscoveryWorker()

  const { getCycleDiscoveryState, updateCycleDiscoveryState } = useQueryState()

  const [params, setParams] = useState<CycleDiscoveryParameters>(DEFAULT_PARAMS)
  const [results, setResults] = useState<CycleDiscoveryResults | null>(null)
  const [selectedCycle, setSelectedCycle] = useState<DiscoveredCycle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasRestoredFromContext, setHasRestoredFromContext] = useState(false)

  // Restore state from context on mount
  useEffect(() => {
    if (!hasRestoredFromContext) {
      const savedState = getCycleDiscoveryState()
      if (savedState) {
        setParams(savedState.params)
        if (savedState.results) {
          setResults(savedState.results)
        }
      }
      setHasRestoredFromContext(true)
    }
  }, [hasRestoredFromContext, getCycleDiscoveryState])

  // Save state to context whenever params or results change
  useEffect(() => {
    if (!hasRestoredFromContext) return

    updateCycleDiscoveryState({
      params,
      results: results || undefined,
    })
  }, [hasRestoredFromContext, params, results, updateCycleDiscoveryState])

  const handleSearch = async () => {
    if (!db) {
      setError(t('cycleDiscovery.databaseNotLoaded'))
      return
    }

    setError(null)
    setResults(null)
    setSelectedCycle(null)

    try {
      const dbBuffer = db.export().buffer
      const discoveryResults = await runDiscovery(params, dbBuffer as ArrayBuffer)
      setResults(discoveryResults)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred'
      if (message !== 'Cycle discovery cancelled by user') {
        setError(message)
      }
      console.error('Cycle discovery error:', err)
    }
  }

  const handleViewCycle = (cycle: DiscoveredCycle) => {
    const cycleIndex = results?.cycles.indexOf(cycle) ?? -1
    setSelectedCycle(cycle)
    window.history.pushState({ cycleDetail: true, cycleIndex }, '')
  }

  // Prev/next navigation while on the detail view. Uses replaceState rather
  // than pushState so browser-back from any cycle returns to the list rather
  // than retracing every prev/next click.
  const handleNavigateCycle = (delta: number) => {
    if (!results || !selectedCycle) return
    const idx = results.cycles.indexOf(selectedCycle)
    const next = results.cycles[idx + delta]
    if (!next) return
    setSelectedCycle(next)
    window.history.replaceState(
      { cycleDetail: true, cycleIndex: idx + delta },
      ''
    )
  }

  // Listen for browser back/forward to toggle cycle detail view
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.cycleDetail && e.state.cycleIndex >= 0 && results?.cycles) {
        setSelectedCycle(results.cycles[e.state.cycleIndex] ?? null)
      } else {
        setSelectedCycle(null)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [results])

  const handleRunSimulation = (cycle: DiscoveredCycle) => {
    // Navigate to cascades page with pre-filled fuel nuclides
    const fuelIds = cycle.fuelNuclides.map((n) => `${n.E}-${n.A}`)
    // Store fuel in sessionStorage for the cascades page to pick up
    sessionStorage.setItem('cascade-prefill-fuel', JSON.stringify(fuelIds))
    navigate('/cascades')
  }

  const handleBack = () => {
    window.history.back()
  }

  const displayError = error || workerError

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <RefreshCw className="w-8 h-8 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('cycleDiscovery.pageTitle')}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('cycleDiscovery.pageDescription')}
        </p>
      </div>

      {!selectedCycle && (
        <>
          {/* Info banner */}
          <div className="card p-6 mb-6 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <strong>{t('cycleDiscovery.howItWorksTitle')}:</strong>{' '}
                {t('cycleDiscovery.howItWorksDescription')}
              </div>
            </div>
          </div>

          {/* Search form */}
          <div className="mb-6">
            <CycleDiscoverySearch
              params={params}
              onParamsChange={setParams}
              onSearch={handleSearch}
              onCancel={cancelDiscovery}
              isSearching={isRunning}
              progress={progress}
            />
          </div>
        </>
      )}

      {/* Error display */}
      {displayError && (
        <div className="card p-6 mb-6 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">
                {t('common.error')}
              </h3>
              <p className="text-sm text-red-700 dark:text-red-200">
                {displayError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results area */}
      {selectedCycle ? (
        <CycleVisualization
          cycle={selectedCycle}
          onRunSimulation={handleRunSimulation}
          onBack={handleBack}
          onPrev={
            results && results.cycles.indexOf(selectedCycle) > 0
              ? () => handleNavigateCycle(-1)
              : undefined
          }
          onNext={
            results &&
            results.cycles.indexOf(selectedCycle) < results.cycles.length - 1
              ? () => handleNavigateCycle(1)
              : undefined
          }
          currentIndex={results?.cycles.indexOf(selectedCycle) ?? 0}
          totalCount={results?.cycles.length ?? 0}
        />
      ) : results ? (
        <div className="space-y-6">
          {/* Completion banner */}
          <div className="card p-6 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  {t('cycleDiscovery.discoveryComplete')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('cycleDiscovery.cyclesFound')}
                    </span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.totalCyclesFound}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('cycleDiscovery.cyclesDisplayed')}
                    </span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.cycles.length}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('cycleDiscovery.executionTime')}
                    </span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.executionTime.toFixed(0)} ms
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results table */}
          <CycleResultsTable
            cycles={results.cycles}
            onViewCycle={handleViewCycle}
            onRunSimulation={handleRunSimulation}
          />
        </div>
      ) : (
        !isRunning && (
          <div className="card p-6 bg-blue-50 dark:bg-blue-900/30">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              {t('cycleDiscovery.howCyclesWork')}
            </h3>
            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
              <li>{t('cycleDiscovery.howStep1')}</li>
              <li>{t('cycleDiscovery.howStep2')}</li>
              <li>{t('cycleDiscovery.howStep3')}</li>
              <li>{t('cycleDiscovery.howStep4')}</li>
            </ol>
          </div>
        )
      )}
    </div>
  )
}
