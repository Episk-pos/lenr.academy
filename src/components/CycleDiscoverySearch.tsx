import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Atom,
  Settings2,
  Filter,
} from 'lucide-react'
import type { CycleDiscoveryParameters, CycleDiscoveryProgress } from '../types'

interface CycleDiscoverySearchProps {
  params: CycleDiscoveryParameters
  onParamsChange: (params: CycleDiscoveryParameters) => void
  onSearch: () => void
  onCancel: () => void
  isSearching: boolean
  progress: CycleDiscoveryProgress | null
}

export default function CycleDiscoverySearch({
  params,
  onParamsChange,
  onSearch,
  onCancel,
  isSearching,
  progress,
}: CycleDiscoverySearchProps) {
  const { t } = useTranslation()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const updateParam = <K extends keyof CycleDiscoveryParameters>(
    key: K,
    value: CycleDiscoveryParameters[K]
  ) => {
    onParamsChange({ ...params, [key]: value })
  }

  const updateFilter = (
    key: keyof NonNullable<CycleDiscoveryParameters['elementFilters']>,
    value: boolean | string[] | undefined
  ) => {
    onParamsChange({
      ...params,
      elementFilters: {
        ...params.elementFilters,
        [key]: value,
      },
    })
  }

  const phaseLabel = (phase: CycleDiscoveryProgress['phase']) => {
    switch (phase) {
      case 'building_graph':
        return t('cycleDiscovery.phaseBuildingGraph')
      case 'searching_cycles':
        return t('cycleDiscovery.phaseSearchingCycles')
      case 'ranking':
        return t('cycleDiscovery.phaseRanking')
      default:
        return ''
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-5">
        <Atom className="w-5 h-5 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('cycleDiscovery.searchTitle')}
        </h2>
      </div>

      {/* Energy thresholds */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              {t('cycleDiscovery.minFusionEnergy')}
            </span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="input"
            value={params.minFusionMeV}
            onChange={(e) =>
              updateParam('minFusionMeV', parseFloat(e.target.value) || 0)
            }
            disabled={isSearching}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('cycleDiscovery.minFusionEnergyHint')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              {t('cycleDiscovery.minTwoToTwoEnergy')}
            </span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            className="input"
            value={params.minTwoToTwoMeV}
            onChange={(e) =>
              updateParam('minTwoToTwoMeV', parseFloat(e.target.value) || 0)
            }
            disabled={isSearching}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('cycleDiscovery.minTwoToTwoEnergyHint')}
          </p>
        </div>
      </div>

      {/* Depth slider + Max cycles */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <span className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              {t('cycleDiscovery.maxCycleDepth')}: {params.maxCycleDepth}
            </span>
          </label>
          <input
            type="range"
            min="3"
            max="10"
            step="1"
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
            value={params.maxCycleDepth}
            onChange={(e) =>
              updateParam('maxCycleDepth', parseInt(e.target.value))
            }
            disabled={isSearching}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>3</span>
            <span>{t('cycleDiscovery.depthRecommended')}</span>
            <span>10</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('cycleDiscovery.maxCyclesToDisplay')}
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            className="input"
            value={params.maxCycles}
            onChange={(e) =>
              updateParam('maxCycles', parseInt(e.target.value) || 100)
            }
            disabled={isSearching}
          />
        </div>
      </div>

      {/* Fission toggle */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={params.includeFission}
              onChange={(e) => updateParam('includeFission', e.target.checked)}
              className="sr-only"
              disabled={isSearching}
            />
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                params.includeFission
                  ? 'bg-primary-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  params.includeFission ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('cycleDiscovery.includeFission')}
          </span>
        </label>

        {params.includeFission && (
          <div className="mt-3 ml-12 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('cycleDiscovery.minFissionEnergy')}
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input"
              value={params.minFissionMeV ?? 1.0}
              onChange={(e) =>
                updateParam('minFissionMeV', parseFloat(e.target.value) || 0)
              }
              disabled={isSearching}
            />
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      <div className="mb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
        >
          <Filter className="w-4 h-4" />
          {t('cycleDiscovery.advancedFilters')}
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.elementFilters?.abundantOnly ?? false}
                onChange={(e) =>
                  updateFilter('abundantOnly', e.target.checked)
                }
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                disabled={isSearching}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('cycleDiscovery.abundantOnly')}
              </span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={params.elementFilters?.excludeRadioactive ?? false}
                onChange={(e) =>
                  updateFilter('excludeRadioactive', e.target.checked)
                }
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                disabled={isSearching}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t('cycleDiscovery.excludeRadioactive')}
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('cycleDiscovery.allowedElements')}
              </label>
              <input
                type="text"
                className="input"
                placeholder={t('cycleDiscovery.allowedElementsPlaceholder')}
                value={
                  params.elementFilters?.allowedElements?.join(', ') ?? ''
                }
                onChange={(e) => {
                  const val = e.target.value.trim()
                  if (val === '') {
                    updateFilter('allowedElements', undefined)
                  } else {
                    updateFilter(
                      'allowedElements',
                      val
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                }}
                disabled={isSearching}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('cycleDiscovery.allowedElementsHint')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {isSearching && progress && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {phaseLabel(progress.phase)}
              </span>
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t('cycleDiscovery.cyclesFound')}: {progress.cyclesFound}
            </span>
          </div>
          <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, progress.percentage))}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {progress.fuelCombinationsChecked} / {progress.totalCombinations}{' '}
              {t('cycleDiscovery.combinationsChecked')}
            </span>
            <span>{progress.percentage.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {isSearching ? (
          <button
            className="btn bg-red-600 text-white hover:bg-red-700 px-8 py-3"
            onClick={onCancel}
          >
            <X className="w-5 h-5 mr-2 inline" />
            {t('common.cancel')}
          </button>
        ) : (
          <button
            className="btn btn-primary px-8 py-3"
            onClick={onSearch}
          >
            <Search className="w-5 h-5 mr-2 inline" />
            {t('cycleDiscovery.discoverCycles')}
          </button>
        )}
      </div>
    </div>
  )
}
