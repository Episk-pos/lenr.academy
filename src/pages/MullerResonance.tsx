import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useDatabase } from '../contexts/DatabaseContext'
import { getAllElements } from '../services/queryService'
import { useMullerWorker } from '../hooks/useMullerWorker'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import PeriodicTable from '../components/PeriodicTable'
import TabNavigation from '../components/TabNavigation'
import type { Tab } from '../components/TabNavigation'
import type { Element, HeatmapMetrics } from '../types'
import {
  formatWavelength,
  formatFrequency,
  getResonanceQuality,
  getNAEQuality,
  computeMullerMismatch,
  type NAEPrediction,
} from '../services/mullerResonanceService'
import { NAE_GAP_MIN, NAE_GAP_MAX } from '../constants/naeConstants'

const THRESHOLD_OPTIONS = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]

type SortColumn = 'element' | 'naeScore' | 'wavelength' | 'deuterium' | 'phonon' | 'reactions' | 'lenr'
type SortDirection = 'asc' | 'desc'

export default function MullerResonance() {
  const { t } = useTranslation()
  const { db, isLoading: dbLoading, downloadProgress } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()
  const isInitialMount = useRef(true)
  const [elements, setElements] = useState<Element[]>([])

  // Initialize state from URL params (read once on mount)
  const [selectedElement, setSelectedElement] = useState<string | null>(
    searchParams.get('element') || null
  )
  const [threshold, setThreshold] = useState(() => {
    const p = searchParams.get('threshold')
    if (!p) return 5.0
    const n = parseFloat(p)
    return isNaN(n) ? 5.0 : n
  })

  // Tab state
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'resonance')

  // NAE UI state
  const [naeFilter, setNaeFilter] = useState(searchParams.get('naeFilter') === 'true')
  const [naeSortColumn, setNaeSortColumn] = useState<SortColumn>(() => {
    const p = searchParams.get('sort') as SortColumn | null
    return p && ['element', 'naeScore', 'wavelength', 'deuterium', 'phonon', 'reactions', 'lenr'].includes(p) ? p : 'naeScore'
  })
  const [naeSortDirection, setNaeSortDirection] = useState<SortDirection>(() => {
    const p = searchParams.get('dir') as SortDirection | null
    return p === 'desc' ? 'desc' : 'asc'
  })
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  // Worker handles all heavy computation off the main thread
  const {
    initialize: initWorker,
    selectElement: workerSelectElement,
    clearElement: workerClearElement,
    globalPairs,
    globalOverlaps,
    naePredictions,
    reactionCounts,
    pairs,
    overlaps,
    isLoading: loading,
  } = useMullerWorker()

  const tabs: Tab[] = useMemo(() => [
    { id: 'resonance', label: t('mullerResonance.tabs.resonancePairs') },
    { id: 'nae', label: t('mullerResonance.tabs.naePredictions') },
  ], [t])

  // Sync state → URL params (skip initial mount to avoid replacing URL on load)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const params = new URLSearchParams()
    if (activeTab !== 'resonance') params.set('tab', activeTab)
    if (selectedElement) params.set('element', selectedElement)
    if (threshold !== 5.0) params.set('threshold', String(threshold))
    if (naeFilter) params.set('naeFilter', 'true')
    if (activeTab === 'nae' && naeSortColumn !== 'naeScore') params.set('sort', naeSortColumn)
    if (activeTab === 'nae' && naeSortDirection !== 'asc') params.set('dir', naeSortDirection)
    setSearchParams(params, { replace: true })
  }, [activeTab, selectedElement, threshold, naeFilter, naeSortColumn, naeSortDirection, setSearchParams])

  // Load elements and initialize worker
  useEffect(() => {
    if (!db) return
    const allElements = getAllElements(db)
    setElements(allElements)

    // Send DB + elements to worker for all init computations
    const dbBuffer = db.export().buffer as ArrayBuffer
    initWorker(dbBuffer, allElements.map(e => ({ Z: e.Z, E: e.E })))
  }, [db, initWorker])

  const handleElementClick = useCallback((symbol: string) => {
    setSelectedElement(prev => prev === symbol ? null : symbol)
  }, [])

  // Delegate element selection/clearing to worker
  useEffect(() => {
    if (!selectedElement) {
      workerClearElement()
      return
    }

    const el = elements.find(e => e.E === selectedElement)
    if (!el) return

    workerSelectElement(
      el.Z,
      el.E,
      elements.map(e => ({ Z: e.Z, E: e.E })),
      threshold
    )
  }, [selectedElement, threshold, elements, workerSelectElement, workerClearElement])

  // Build heatmap data for periodic table highlighting
  const heatmapData = useMemo(() => {
    const map = new Map<string, number>()

    if (selectedElement) {
      // Per-element view: show resonant partners
      const selectedEl = elements.find(e => e.E === selectedElement)
      if (!selectedEl) return map

      for (const el of elements) {
        if (el.E === selectedElement) continue
        const result = computeMullerMismatch(selectedEl.Z, el.Z)
        if (result && result.mismatch < threshold) {
          const intensity = Math.max(0, 1 - result.mismatch / threshold)
          map.set(el.E, intensity)
        }
      }
    } else {
      // Global view: highlight elements by their best mismatch across all pairs
      const bestMismatch = new Map<string, number>()
      for (const pair of globalPairs) {
        for (const sym of [pair.E1, pair.E2]) {
          const prev = bestMismatch.get(sym) ?? Infinity
          if (pair.mismatch < prev) bestMismatch.set(sym, pair.mismatch)
        }
      }
      const maxMismatch = Math.max(...bestMismatch.values(), 0.01)
      for (const [sym, mm] of bestMismatch) {
        map.set(sym, Math.max(0, 1 - mm / maxMismatch))
      }
    }
    return map
  }, [selectedElement, elements, threshold, globalPairs])

  // Build heatmapMetrics to control the green↔blue gradient
  // Green = strong resonance (low mismatch), Blue = weaker resonance
  const resonanceHeatmapMetrics = useMemo((): HeatmapMetrics | undefined => {
    const inputOutputRatio = new Map<string, { inputCount: number; outputCount: number; ratio: number }>()

    if (selectedElement) {
      const selectedEl = elements.find(e => e.E === selectedElement)
      if (!selectedEl) return undefined

      for (const el of elements) {
        if (el.E === selectedElement) continue
        const result = computeMullerMismatch(selectedEl.Z, el.Z)
        if (result && result.mismatch < threshold) {
          // ratio=1 (green) for best matches, ratio=0 (blue) for worst
          const ratio = Math.max(0, 1 - result.mismatch / threshold)
          inputOutputRatio.set(el.E, { inputCount: 0, outputCount: 0, ratio })
        }
      }
    } else {
      // Global view
      const bestMismatch = new Map<string, number>()
      for (const pair of globalPairs) {
        for (const sym of [pair.E1, pair.E2]) {
          const prev = bestMismatch.get(sym) ?? Infinity
          if (pair.mismatch < prev) bestMismatch.set(sym, pair.mismatch)
        }
      }
      const maxMismatch = Math.max(...bestMismatch.values(), 0.01)
      for (const [sym, mm] of bestMismatch) {
        const ratio = Math.max(0, 1 - mm / maxMismatch)
        inputOutputRatio.set(sym, { inputCount: 0, outputCount: 0, ratio })
      }
    }

    return {
      frequency: new Map(),
      energy: new Map(),
      diversity: new Map(),
      inputOutputRatio,
    }
  }, [selectedElement, elements, threshold, globalPairs])

  // NAE heatmap: rank-based normalization for better dynamic range
  const naeHeatmapData = useMemo(() => {
    const map = new Map<string, number>()

    // Separate in-range and out-of-range elements
    const inRange: NAEPrediction[] = []
    const outOfRange: NAEPrediction[] = []
    for (const pred of naePredictions) {
      const isInRange = pred.naeWavelength !== null &&
        pred.naeWavelength >= NAE_GAP_MIN &&
        pred.naeWavelength <= NAE_GAP_MAX
      if (isInRange) {
        inRange.push(pred)
      } else if (pred.naeWavelength !== null) {
        outOfRange.push(pred)
      }
    }

    // In-range: rank-based intensity (best = 1.0, worst in-range = 0.5)
    const sorted = [...inRange].sort((a, b) => a.naeScore - b.naeScore)
    const count = sorted.length
    for (let i = 0; i < count; i++) {
      const intensity = count > 1
        ? 1.0 - 0.5 * (i / (count - 1))
        : 1.0
      map.set(sorted[i].E, intensity)
    }

    // Out-of-range: faint presence for visual contrast
    for (const pred of outOfRange) {
      map.set(pred.E, 0.12)
    }

    return map
  }, [naePredictions])

  // NAE heatmap metrics: green = best NAE match, blue = weaker/out-of-range
  const naeHeatmapMetrics = useMemo((): HeatmapMetrics => {
    const inputOutputRatio = new Map<string, { inputCount: number; outputCount: number; ratio: number }>()

    const inRange: NAEPrediction[] = []
    const outOfRange: NAEPrediction[] = []
    for (const pred of naePredictions) {
      const isInRange = pred.naeWavelength !== null &&
        pred.naeWavelength >= NAE_GAP_MIN &&
        pred.naeWavelength <= NAE_GAP_MAX
      if (isInRange) {
        inRange.push(pred)
      } else if (pred.naeWavelength !== null) {
        outOfRange.push(pred)
      }
    }

    // In-range: rank-based ratio (best = 1.0/green, worst in-range = 0.5/teal)
    const sorted = [...inRange].sort((a, b) => a.naeScore - b.naeScore)
    const count = sorted.length
    for (let i = 0; i < count; i++) {
      const ratio = count > 1
        ? 1.0 - 0.5 * (i / (count - 1))
        : 1.0
      inputOutputRatio.set(sorted[i].E, { inputCount: 0, outputCount: 0, ratio })
    }

    // Out-of-range: blue end of gradient
    for (const pred of outOfRange) {
      inputOutputRatio.set(pred.E, { inputCount: 0, outputCount: 0, ratio: 0 })
    }

    return {
      frequency: new Map(),
      energy: new Map(),
      diversity: new Map(),
      inputOutputRatio,
    }
  }, [naePredictions])

  // Stats
  const stats = useMemo(() => {
    const exact = pairs.filter(p => p.mismatch < 0.01).length
    const strong = pairs.filter(p => p.mismatch < 0.5).length
    const withReactions = overlaps.filter(o => o.twoToTwoCount > 0 || o.fusionCount > 0).length
    const totalReactions = overlaps.reduce((s, o) => s + o.twoToTwoCount + o.fusionCount, 0)
    return { exact, strong, withReactions, totalReactions }
  }, [pairs, overlaps])

  // NAE stats
  const naeStats = useMemo(() => {
    const inRange = naePredictions.filter(p =>
      p.naeWavelength !== null &&
      p.naeWavelength >= NAE_GAP_MIN &&
      p.naeWavelength <= NAE_GAP_MAX
    ).length
    const withLENR = naePredictions.filter(p => p.lenrStrength !== null).length
    const withOverlap = naePredictions.filter(p =>
      p.deuteriumMismatch !== null && p.deuteriumMismatch < 50
    ).length
    return { inRange, withLENR, withOverlap }
  }, [naePredictions])

  // Sorted and filtered NAE predictions
  const sortedNAEPredictions = useMemo(() => {
    let filtered = naePredictions
    if (naeFilter) {
      filtered = naePredictions.filter(p =>
        p.naeWavelength !== null &&
        p.naeWavelength >= NAE_GAP_MIN &&
        p.naeWavelength <= NAE_GAP_MAX
      )
    }

    return [...filtered].sort((a, b) => {
      const dir = naeSortDirection === 'asc' ? 1 : -1
      switch (naeSortColumn) {
        case 'element': return dir * a.E.localeCompare(b.E)
        case 'naeScore': return dir * (a.naeScore - b.naeScore)
        case 'wavelength': return dir * ((a.naeWavelength ?? Infinity) - (b.naeWavelength ?? Infinity))
        case 'deuterium': return dir * ((a.deuteriumMismatch ?? Infinity) - (b.deuteriumMismatch ?? Infinity))
        case 'phonon': return dir * ((a.phononFrequency ?? 0) - (b.phononFrequency ?? 0))
        case 'reactions': {
          const aRxn = reactionCounts.get(a.Z) ?? 0
          const bRxn = reactionCounts.get(b.Z) ?? 0
          return dir * (aRxn - bRxn)
        }
        case 'lenr': {
          const aVal = a.lenrStrength === 'strong' ? 3 : a.lenrStrength === 'moderate' ? 2 : a.lenrStrength === 'weak' ? 1 : 0
          const bVal = b.lenrStrength === 'strong' ? 3 : b.lenrStrength === 'moderate' ? 2 : b.lenrStrength === 'weak' ? 1 : 0
          return dir * (aVal - bVal)
        }
        default: return 0
      }
    })
  }, [naePredictions, naeFilter, naeSortColumn, naeSortDirection, reactionCounts])

  const handleNAESort = useCallback((col: SortColumn) => {
    setNaeSortColumn(prev => {
      if (prev === col) {
        setNaeSortDirection(d => d === 'asc' ? 'desc' : 'asc')
        return col
      }
      setNaeSortDirection('asc')
      return col
    })
  }, [])

  const sortIndicator = useCallback((col: SortColumn) => {
    if (naeSortColumn !== col) return ''
    return naeSortDirection === 'asc' ? ' ↑' : ' ↓'
  }, [naeSortColumn, naeSortDirection])

  const ariaSort = useCallback((col: SortColumn): 'ascending' | 'descending' | 'none' => {
    if (naeSortColumn !== col) return 'none'
    return naeSortDirection === 'asc' ? 'ascending' : 'descending'
  }, [naeSortColumn, naeSortDirection])

  if (dbLoading || !db) {
    return (
      <div className="max-w-7xl mx-auto">
        <DatabaseLoadingCard downloadProgress={downloadProgress} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="card p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('mullerResonance.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('mullerResonance.description')}
        </p>
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <p className="font-mono text-lg text-center text-gray-900 dark:text-white mb-2">
            L = Z &times; C<sub>e</sub> &times; 2<sup>N</sup>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {t('mullerResonance.equationExplanation')}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="mb-6"
      />

      {/* ================================================================ */}
      {/* RESONANCE PAIRS TAB                                              */}
      {/* ================================================================ */}
      {activeTab === 'resonance' && (
        <>
          {/* Threshold selector */}
          <div className="card p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('mullerResonance.threshold')}:
              </span>
              {THRESHOLD_OPTIONS.map(t_val => (
                <button
                  key={t_val}
                  onClick={() => setThreshold(t_val)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    threshold === t_val
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  &lt; {t_val}%
                </button>
              ))}
            </div>
          </div>

          {/* Periodic Table */}
          <div className="card p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('mullerResonance.selectElement')}
            </h2>
            <PeriodicTable
              availableElements={elements}
              selectedElement={selectedElement}
              onElementClick={handleElementClick}
              heatmapData={heatmapData}
              heatmapMetrics={resonanceHeatmapMetrics}
              showHeatmap={heatmapData.size > 0}
              hideLegend
              hideCardContainer
            />
            {selectedElement && (
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('mullerResonance.resonantPartners')}: <strong className="text-gray-900 dark:text-white">{pairs.length}</strong>
                </span>
                {stats.exact > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t('mullerResonance.exactMatches')}: <strong>{stats.exact}</strong>
                  </span>
                )}
                <span className="text-gray-600 dark:text-gray-400">
                  {t('mullerResonance.withReactions')}: <strong className="text-gray-900 dark:text-white">{stats.withReactions}</strong>
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('mullerResonance.totalReactions')}: <strong className="text-gray-900 dark:text-white">{stats.totalReactions.toLocaleString()}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Results table */}
          {(() => {
            const displayPairs = selectedElement ? pairs : globalPairs
            const displayOverlaps = selectedElement ? overlaps : globalOverlaps
            const isGlobal = !selectedElement

            return (
              <div className="card p-4 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {isGlobal
                    ? t('mullerResonance.topGlobalPairs')
                    : t('mullerResonance.resonancePairs')
                  }
                </h2>

                {loading ? (
                  <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                ) : displayPairs.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">{t('mullerResonance.noResonantPairs')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left py-2 px-3 text-gray-700 dark:text-gray-300">
                            {isGlobal ? t('mullerResonance.pair') : t('mullerResonance.partner')}
                          </th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{t('mullerResonance.mismatchHeader')}</th>
                          <th className="text-center py-2 px-3 text-gray-700 dark:text-gray-300">{t('mullerResonance.quality')}</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{t('mullerResonance.wavelength')}</th>
                          <th className="text-center py-2 px-3 text-gray-700 dark:text-gray-300">{t('mullerResonance.octaves')}</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{t('mullerResonance.twoToTwo')}</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{t('mullerResonance.fusion')}</th>
                          <th className="text-right py-2 px-3 text-gray-700 dark:text-gray-300">{t('mullerResonance.avgMeV')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayOverlaps.map((overlap, i) => {
                          const pair = displayPairs[i]
                          if (!pair) return null
                          const quality = getResonanceQuality(pair.mismatch)
                          const qualityColors: Record<string, string> = {
                            exact: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
                            strong: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                            moderate: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
                            weak: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                          }

                          return (
                            <tr
                              key={`${pair.Z1}-${pair.Z2}`}
                              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
                              <td className="py-2 px-3 font-medium text-gray-900 dark:text-white">
                                {isGlobal ? (
                                  <>
                                    {pair.E1} <span className="text-gray-400 dark:text-gray-500">–</span> {pair.E2}
                                  </>
                                ) : (
                                  <>
                                    {pair.E2} <span className="text-gray-400 dark:text-gray-500">(Z={pair.Z2})</span>
                                  </>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                {pair.mismatch < 0.01 ? pair.mismatch.toFixed(4) : pair.mismatch.toFixed(2)}%
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${qualityColors[quality]}`}>
                                  {t(`mullerResonance.qualityLabels.${quality}`)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                {formatWavelength(pair.wavelength)}
                              </td>
                              <td className="py-2 px-3 text-center text-gray-500 dark:text-gray-400 font-mono text-xs">
                                <span title={t('mullerResonance.electronOctave')}>e:{pair.electronOctave}</span>
                                {' / '}
                                <span title={t('mullerResonance.protonOctave')}>p:{pair.protonOctave}</span>
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                                {overlap.twoToTwoCount > 0 ? overlap.twoToTwoCount.toLocaleString() : (
                                  <span className="text-gray-400 dark:text-gray-600">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                                {overlap.fusionCount > 0 ? overlap.fusionCount : (
                                  <span className="text-gray-400 dark:text-gray-600">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                                {overlap.avgMeV > 0 ? overlap.avgMeV.toFixed(1) : (
                                  <span className="text-gray-400 dark:text-gray-600">-</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Explanation card */}
          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('mullerResonance.aboutTitle')}
            </h2>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p>{t('mullerResonance.about1')}</p>
              <p>{t('mullerResonance.about2')}</p>
              <p>{t('mullerResonance.about3')}</p>
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-amber-800 dark:text-amber-300 text-xs">
                  {t('mullerResonance.disclaimer')}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================================ */}
      {/* NAE PREDICTIONS TAB                                              */}
      {/* ================================================================ */}
      {activeTab === 'nae' && (
        <>
          {/* NAE Periodic Table */}
          <div className="card p-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('mullerResonance.nae.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t('mullerResonance.nae.description')}
            </p>
            <PeriodicTable
              availableElements={elements}
              selectedElement={null}
              onElementClick={handleElementClick}
              heatmapData={naeHeatmapData}
              heatmapMetrics={naeHeatmapMetrics}
              showHeatmap={true}
              hideLegend
              hideCardContainer
            />
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {t('mullerResonance.nae.elementsInRange')}: <strong className="text-emerald-600 dark:text-emerald-400">{naeStats.inRange}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {t('mullerResonance.nae.withDOverlap')}: <strong className="text-blue-600 dark:text-blue-400">{naeStats.withOverlap}</strong>
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {t('mullerResonance.nae.confirmedLENR')}: <strong className="text-amber-600 dark:text-amber-400">{naeStats.withLENR}</strong>
              </span>
            </div>
          </div>

          {/* Filter toggle */}
          <div className="card p-4 mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={naeFilter}
                onChange={(e) => setNaeFilter(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('mullerResonance.nae.showNAEOnly')}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                (0.5–2.0 nm)
              </span>
            </label>
          </div>

          {/* NAE Predictions Table */}
          <div className="card p-4 mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th
                      className="text-left py-2 px-3 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none"
                      aria-sort={ariaSort('element')}
                      onClick={() => handleNAESort('element')}
                    >
                      {t('mullerResonance.nae.element')}{sortIndicator('element')}
                    </th>
                    <th
                      className="text-center py-2 px-3 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none"
                      aria-sort={ariaSort('naeScore')}
                      onClick={() => handleNAESort('naeScore')}
                    >
                      {t('mullerResonance.nae.octave')}{sortIndicator('naeScore')}
                    </th>
                    <th
                      className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none"
                      aria-sort={ariaSort('wavelength')}
                      onClick={() => handleNAESort('wavelength')}
                    >
                      {t('mullerResonance.nae.electronResonance')}{sortIndicator('wavelength')}
                    </th>
                    <th className="text-center py-2 px-3 text-gray-700 dark:text-gray-300">
                      {t('mullerResonance.nae.naeQuality')}
                    </th>
                    <th
                      className="text-center py-2 px-3 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none"
                      aria-sort={ariaSort('deuterium')}
                      onClick={() => handleNAESort('deuterium')}
                    >
                      {t('mullerResonance.nae.deuteriumOverlap')}{sortIndicator('deuterium')}
                    </th>
                    <th
                      className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none"
                      aria-sort={ariaSort('phonon')}
                      onClick={() => handleNAESort('phonon')}
                    >
                      {t('mullerResonance.nae.phononFrequency')}{sortIndicator('phonon')}
                    </th>
                    <th
                      className="text-right py-2 px-3 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none"
                      aria-sort={ariaSort('reactions')}
                      onClick={() => handleNAESort('reactions')}
                    >
                      {t('mullerResonance.nae.parkhomovReactions')}{sortIndicator('reactions')}
                    </th>
                    <th
                      className="text-center py-2 px-3 text-gray-700 dark:text-gray-300 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 select-none"
                      aria-sort={ariaSort('lenr')}
                      onClick={() => handleNAESort('lenr')}
                    >
                      {t('mullerResonance.nae.knownLENR')}{sortIndicator('lenr')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedNAEPredictions.map((pred) => {
                    const inRange = pred.naeWavelength !== null &&
                      pred.naeWavelength >= NAE_GAP_MIN &&
                      pred.naeWavelength <= NAE_GAP_MAX
                    const quality = getNAEQuality(pred.naeScore, inRange)
                    const isExpanded = expandedRow === pred.Z

                    const qualityColors: Record<string, string> = {
                      optimal: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
                      good: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                      marginal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
                      distant: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                    }

                    const lenrColors: Record<string, string> = {
                      strong: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
                      moderate: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                      weak: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
                    }

                    const rxCount = reactionCounts.get(pred.Z) ?? 0

                    return (
                      <tr
                        key={pred.Z}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors ${
                          inRange
                            ? 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        } ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : pred.Z)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setExpandedRow(isExpanded ? null : pred.Z)
                          }
                        }}
                      >
                        <td className={`py-2 px-3 font-medium ${pred.lenrStrength ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {pred.E} <span className="text-gray-400 dark:text-gray-500 text-xs">(Z={pred.Z})</span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-gray-700 dark:text-gray-300">
                          N={pred.naeOctave ?? '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                          {pred.naeWavelength !== null ? `${(pred.naeWavelength * 1e9).toFixed(2)} nm` : '-'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${qualityColors[quality]}`}>
                            {t(`mullerResonance.nae.qualityLabels.${quality}`)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-xs text-gray-500 dark:text-gray-400">
                          {pred.deuteriumMismatch !== null ? (
                            <>
                              <span>N={pred.deuteriumOverlapN}</span>
                              {' '}
                              <span className={pred.deuteriumMismatch < 30 ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                ({pred.deuteriumMismatch.toFixed(1)}%)
                              </span>
                            </>
                          ) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                          {pred.phononFrequency !== null ? formatFrequency(pred.phononFrequency) : (
                            <span className="text-gray-400 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                          {rxCount > 0 ? rxCount.toLocaleString() : (
                            <span className="text-gray-400 dark:text-gray-600">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {pred.lenrStrength ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${lenrColors[pred.lenrStrength]}`}>
                              {t(`mullerResonance.nae.lenrLabels.${pred.lenrStrength}`)}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-600">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expanded Row Detail */}
          {expandedRow !== null && (() => {
            const pred = naePredictions.find(p => p.Z === expandedRow)
            if (!pred) return null

            return (
              <div className="card p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {pred.E} (Z={pred.Z}) — {t('mullerResonance.nae.octaveDetail')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Electron resonance octaves */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('mullerResonance.nae.electronOctaves')}
                    </h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="text-center py-1 px-2 text-gray-500 dark:text-gray-400">N</th>
                          <th className="text-right py-1 px-2 text-gray-500 dark:text-gray-400">{t('mullerResonance.wavelength')}</th>
                          <th className="text-center py-1 px-2 text-gray-500 dark:text-gray-400">{t('mullerResonance.nae.inNAERange')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pred.electronResonances.map(res => {
                          const inNAE = res.L >= NAE_GAP_MIN && res.L <= NAE_GAP_MAX
                          return (
                            <tr
                              key={res.N}
                              className={`border-b border-gray-50 dark:border-gray-800/50 ${
                                inNAE ? 'bg-emerald-50 dark:bg-emerald-900/20 font-medium' : ''
                              }`}
                            >
                              <td className="py-1 px-2 text-center text-gray-600 dark:text-gray-400">{res.N}</td>
                              <td className="py-1 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                                {formatWavelength(res.L)}
                              </td>
                              <td className="py-1 px-2 text-center">
                                {inNAE ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">NAE</span>
                                ) : null}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Deuterium proton overlap */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('mullerResonance.nae.deuteriumProtonResonance')}
                    </h4>
                    {pred.naeWavelength !== null ? (
                      <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                        <p>
                          {t('mullerResonance.nae.hostElectron')}: <strong className="text-gray-900 dark:text-white font-mono">{(pred.naeWavelength * 1e9).toFixed(2)} nm</strong> (N={pred.naeOctave})
                        </p>
                        {pred.deuteriumOverlapL !== null && (
                          <>
                            <p>
                              {t('mullerResonance.nae.dProton')}: <strong className="text-gray-900 dark:text-white font-mono">{(pred.deuteriumOverlapL * 1e9).toFixed(2)} nm</strong> (N={pred.deuteriumOverlapN})
                            </p>
                            <p>
                              {t('mullerResonance.nae.overlapMismatch')}: <strong className={`font-mono ${pred.deuteriumMismatch !== null && pred.deuteriumMismatch < 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>{pred.deuteriumMismatch?.toFixed(1)}%</strong>
                            </p>
                          </>
                        )}
                        {pred.phononFrequency !== null && pred.speedOfSound !== null && (
                          <p>
                            {t('mullerResonance.nae.phononCalc')}: {pred.speedOfSound.toLocaleString()} m/s / {(pred.naeWavelength * 1e9).toFixed(2)} nm = <strong className="text-gray-900 dark:text-white font-mono">{formatFrequency(pred.phononFrequency)}</strong>
                          </p>
                        )}
                        {pred.lenrReference && (
                          <p className="pt-1 border-t border-gray-200 dark:border-gray-700">
                            {t('mullerResonance.nae.lenrRefs')}: <span className="text-gray-500 dark:text-gray-400">{pred.lenrReference}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('mullerResonance.nae.noNAEResonance')}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* NAE Explanation Card */}
          <div className="card p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('mullerResonance.nae.aboutNAETitle')}
            </h2>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p>{t('mullerResonance.nae.aboutNAE1')}</p>
              <p>{t('mullerResonance.nae.aboutNAE2')}</p>
              <p>{t('mullerResonance.nae.aboutNAE3')}</p>
              <p>{t('mullerResonance.nae.aboutNAE4')}</p>
              <div className="p-3 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-amber-800 dark:text-amber-300 text-xs">
                  {t('mullerResonance.nae.naeDisclaimer')}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
