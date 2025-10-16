import { useState, useEffect, useMemo } from 'react'
import { Download, Info, Loader2, Eye, EyeOff, Radiation, ChevronDown, ChevronUp } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import type { FusionReaction, QueryFilter, Nuclide, Element, AtomicRadiiData, HeatmapMode, HeatmapMetrics } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { queryFusion, getAllElements, getElementBySymbol, getNuclideBySymbol, getAtomicRadii, getFusionSqlPreview, calculateHeatmapMetrics } from '../services/queryService'
import { normalizeElementSymbol } from '../utils/formatUtils'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import PeriodicTable from '../components/PeriodicTable'
import ElementDetailsCard from '../components/ElementDetailsCard'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'

// Default values
const DEFAULT_ELEMENT1 = ['H']
const DEFAULT_ELEMENT2 = ['C', 'O']
const DEFAULT_OUTPUT_ELEMENT: string[] = []
const DEFAULT_NEUTRINO_TYPES = ['none', 'left', 'right']
const DEFAULT_LIMIT = 100

export default function FusionQuery() {
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()
  const [elements, setElements] = useState<Element[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Helper to check if any URL parameters exist
  const hasAnyUrlParams = () => searchParams.toString().length > 0

  // Parse URL parameters or use defaults (only if no params exist)
  const getInitialElement1 = () => {
    const param = searchParams.get('e1')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_ELEMENT1
  }

  const getInitialElement2 = () => {
    const param = searchParams.get('e2')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_ELEMENT2
  }

  const getInitialOutputElement = () => {
    const param = searchParams.get('e')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_OUTPUT_ELEMENT
  }

  const getInitialMinMeV = () => {
    const param = searchParams.get('minMeV')
    return param ? parseFloat(param) : undefined
  }

  const getInitialMaxMeV = () => {
    const param = searchParams.get('maxMeV')
    return param ? parseFloat(param) : undefined
  }

  const getInitialNeutrinoTypes = () => {
    const param = searchParams.get('neutrino')
    return param ? param.split(',') : DEFAULT_NEUTRINO_TYPES
  }

  const getInitialLimit = () => {
    const param = searchParams.get('limit')
    return param ? parseInt(param) : DEFAULT_LIMIT
  }

  const [filter, setFilter] = useState<QueryFilter>({
    elements: [],
    minMeV: getInitialMinMeV(),
    maxMeV: getInitialMaxMeV(),
    neutrinoTypes: getInitialNeutrinoTypes() as any[],
    limit: getInitialLimit(),
    orderBy: 'MeV',
    orderDirection: 'desc'
  })

  const [results, setResults] = useState<FusionReaction[]>([])
  const [nuclides, setNuclides] = useState<Nuclide[]>([])
  const [resultElements, setResultElements] = useState<Element[]>([])
  const [radioactiveNuclides, setRadioactiveNuclides] = useState<Set<string>>(new Set())
  const [showResults, setShowResults] = useState(false)
  const [selectedElement1, setSelectedElement1] = useState<string[]>(getInitialElement1())
  const [selectedElement2, setSelectedElement2] = useState<string[]>(getInitialElement2())
  const [selectedOutputElement, setSelectedOutputElement] = useState<string[]>(getInitialOutputElement())
  const [isQuerying, setIsQuerying] = useState(false)
  const [executionTime, setExecutionTime] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [showBosonFermion, setShowBosonFermion] = useState(() => {
    const saved = localStorage.getItem('showBosonFermion')
    if (saved !== null) return JSON.parse(saved)
    // Default to show (on) for desktop (≥768px), hide (off) for mobile
    return window.innerWidth >= 768
  })
  const [highlightedNuclide, setHighlightedNuclide] = useState<string | null>(null)
  const [pinnedNuclide, setPinnedNuclide] = useState(false)
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null)
  const [pinnedElement, setPinnedElement] = useState(false)
  const [selectedElementDetails, setSelectedElementDetails] = useState<Element | null>(null)
  const [selectedNuclideDetails, setSelectedNuclideDetails] = useState<Nuclide | null>(null)
  const [selectedElementRadii, setSelectedElementRadii] = useState<AtomicRadiiData | null>(null)
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false)

  // Heatmap state
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('frequency')
  const [useAllResultsForHeatmap, setUseAllResultsForHeatmap] = useState(false)
  const [allResults, setAllResults] = useState<FusionReaction[]>([])

  // Filters visibility state (collapsed by default)
  const [showFilters, setShowFilters] = useState(false)

  const queryFilter = useMemo<QueryFilter>(() => {
    const filterWithSelections: QueryFilter = {
      ...filter,
      element1List: selectedElement1.length > 0 ? selectedElement1 : undefined,
      element2List: selectedElement2.length > 0 ? selectedElement2 : undefined,
      outputElementList: selectedOutputElement.length > 0 ? selectedOutputElement : undefined
    }
    return filterWithSelections
  }, [filter, selectedElement1, selectedElement2, selectedOutputElement])

  const sqlPreview = useMemo(() => getFusionSqlPreview(queryFilter), [queryFilter])

  // Calculate heatmap metrics from results (either limited or all)
  const heatmapMetrics = useMemo<HeatmapMetrics>(() => {
    const dataToUse = useAllResultsForHeatmap ? allResults : results
    if (dataToUse.length === 0) {
      return {
        frequency: new Map(),
        energy: new Map(),
        diversity: new Map()
      }
    }
    return calculateHeatmapMetrics(dataToUse, 'fusion')
  }, [results, allResults, useAllResultsForHeatmap])

  // Filter nuclides to only show those of the pinned element
  const filteredNuclides = useMemo(() => {
    if (!pinnedElement || !highlightedElement) {
      return nuclides
    }
    // Filter to only show nuclides of the highlighted/pinned element
    const normalizedElement = normalizeElementSymbol(highlightedElement)
    return nuclides.filter(nuc => normalizeElementSymbol(nuc.E) === normalizedElement)
  }, [nuclides, pinnedElement, highlightedElement])

  // Load elements when database is ready
  useEffect(() => {
    if (db) {
      const allElements = getAllElements(db)
      setElements(allElements)
      setIsInitialized(true)
    }
  }, [db])

  // Initialize pinned state from URL params (after results are loaded)
  // This effect should ONLY run once when results first load, not on every URL change
  useEffect(() => {
    if (!showResults || !isInitialized || hasInitializedFromUrl) return

    const pinE = searchParams.get('pinE')
    const pinN = searchParams.get('pinN')

    // Only initialize if we have URL params and nothing is currently pinned
    // This prevents re-pinning on every results change
    if (pinN && !pinnedNuclide && nuclides.some(nuc => `${nuc.E}-${nuc.A}` === pinN)) {
      // Pinning nuclide from URL - also pin its parent element and expand heatmap
      const [elementSymbol] = pinN.split('-')
      setHighlightedNuclide(pinN)
      setPinnedNuclide(true)
      setHighlightedElement(normalizeElementSymbol(elementSymbol))
      setPinnedElement(true)
      setShowHeatmap(true) // Auto-expand heatmap when loading with pinned state
      setHasInitializedFromUrl(true)
    } else if (pinE && !pinnedElement) {
      // Pin element from URL and expand heatmap (regardless of whether it's in results)
      // The element might be an input that doesn't appear in outputs, so we don't check resultElements
      setHighlightedElement(pinE)
      setPinnedElement(true)
      setShowHeatmap(true) // Auto-expand heatmap when loading with pinned state
      setHasInitializedFromUrl(true)
    } else {
      // No URL params to initialize from
      setHasInitializedFromUrl(true)
    }
  }, [showResults, isInitialized, resultElements, nuclides, hasInitializedFromUrl, searchParams, pinnedElement, pinnedNuclide])

  // Save B/F toggle to localStorage
  useEffect(() => {
    localStorage.setItem('showBosonFermion', JSON.stringify(showBosonFermion))
  }, [showBosonFermion])

  // Fetch element or nuclide details when pinned
  useEffect(() => {
    if (!db) {
      setSelectedElementDetails(null)
      setSelectedNuclideDetails(null)
      setSelectedElementRadii(null)
      return
    }

    // Fetch element details if pinned
    if (pinnedElement && highlightedElement) {
      const elementDetails = getElementBySymbol(db, highlightedElement)
      setSelectedElementDetails(elementDetails)
      // Fetch atomic radii for the element
      if (elementDetails) {
        const radiiData = getAtomicRadii(db, elementDetails.Z)
        setSelectedElementRadii(radiiData)
      } else {
        setSelectedElementRadii(null)
      }
    } else {
      setSelectedElementDetails(null)
      setSelectedElementRadii(null)
    }

    // Fetch nuclide details if pinned
    if (pinnedNuclide && highlightedNuclide) {
      const [elementSymbol, massStr] = highlightedNuclide.split('-')
      const massNumber = parseInt(massStr)
      const nuclideDetails = getNuclideBySymbol(db, elementSymbol, massNumber)
      setSelectedNuclideDetails(nuclideDetails)
    } else {
      setSelectedNuclideDetails(null)
    }
  }, [db, pinnedElement, highlightedElement, pinnedNuclide, highlightedNuclide])

  // Update URL when filters or pinned state changes
  useEffect(() => {
    if (!isInitialized) return

    const params = new URLSearchParams()

    // Only add parameters if they differ from defaults
    if (selectedElement1.length > 0 && JSON.stringify(selectedElement1) !== JSON.stringify(DEFAULT_ELEMENT1)) {
      params.set('e1', selectedElement1.join(','))
    } else if (selectedElement1.length > 0) {
      // Include default to distinguish from "any"
      params.set('e1', selectedElement1.join(','))
    }

    if (selectedElement2.length > 0 && JSON.stringify(selectedElement2) !== JSON.stringify(DEFAULT_ELEMENT2)) {
      params.set('e2', selectedElement2.join(','))
    } else if (selectedElement2.length > 0) {
      // Include default to distinguish from "any"
      params.set('e2', selectedElement2.join(','))
    }

    if (selectedOutputElement.length > 0) {
      params.set('e', selectedOutputElement.join(','))
    }

    if (filter.minMeV !== undefined) {
      params.set('minMeV', filter.minMeV.toString())
    }

    if (filter.maxMeV !== undefined) {
      params.set('maxMeV', filter.maxMeV.toString())
    }

    if (JSON.stringify(filter.neutrinoTypes) !== JSON.stringify(DEFAULT_NEUTRINO_TYPES)) {
      params.set('neutrino', filter.neutrinoTypes?.join(',') || '')
    }

    if (filter.limit !== DEFAULT_LIMIT) {
      params.set('limit', filter.limit?.toString() || DEFAULT_LIMIT.toString())
    }

    // Add pinned element/nuclide state
    if (pinnedElement && highlightedElement) {
      params.set('pinE', highlightedElement)
    } else if (!showResults) {
      // Preserve existing pinE parameter during initial load until pinning logic runs
      const existingPinE = searchParams.get('pinE')
      if (existingPinE) {
        params.set('pinE', existingPinE)
      }
    }

    if (pinnedNuclide && highlightedNuclide) {
      params.set('pinN', highlightedNuclide)
    } else if (!showResults) {
      // Preserve existing pinN parameter during initial load until pinning logic runs
      const existingPinN = searchParams.get('pinN')
      if (existingPinN) {
        params.set('pinN', existingPinN)
      }
    }

    setSearchParams(params, { replace: true })
  }, [selectedElement1, selectedElement2, selectedOutputElement, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit, pinnedElement, highlightedElement, pinnedNuclide, highlightedNuclide, isInitialized, showResults, searchParams])

  // Auto-execute query when filters change
  useEffect(() => {
    if (db) {
      handleQuery()
    }
  }, [db, queryFilter])

  const handleQuery = () => {
    if (!db) return

    setIsQuerying(true)

    try {
      const result = queryFusion(db, queryFilter)

      setResults(result.reactions)
      setNuclides(result.nuclides)
      setResultElements(result.elements)
      setRadioactiveNuclides(result.radioactiveNuclides)
      setExecutionTime(result.executionTime)
      setTotalCount(result.totalCount)
      setShowResults(true)

      // Also fetch unlimited results for heatmap if toggle is enabled
      if (useAllResultsForHeatmap && result.totalCount > result.reactions.length) {
        const unlimitedQuery = { ...queryFilter, limit: undefined }
        const unlimitedResult = queryFusion(db, unlimitedQuery)
        setAllResults(unlimitedResult.reactions)
      } else if (!useAllResultsForHeatmap) {
        setAllResults([]) // Clear allResults if toggle is off
      }
    } catch (error) {
      console.error('Query failed:', error)
      alert(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsQuerying(false)
    }
  }

  const exportToCSV = () => {
    if (results.length === 0) return

    const headers = ['E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'E', 'Z', 'A', 'MeV', 'neutrino', 'nBorF1', 'aBorF1', 'nBorF2', 'aBorF2', 'nBorF', 'aBorF']
    const csvContent = [
      headers.join(','),
      ...results.map(r => [
        r.E1, r.Z1, r.A1, r.E2, r.Z2, r.A2, r.E, r.Z, r.A, r.MeV, r.neutrino, r.nBorF1, r.aBorF1, r.nBorF2, r.aBorF2, r.nBorF, r.aBorF
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fusion_reactions_${Date.now()}.csv`
    a.click()
  }

  // Helper function to check if a reaction contains a specific nuclide
  const reactionContainsNuclide = (reaction: FusionReaction, nuclide: string) => {
    const [element, mass] = nuclide.split('-')
    const A = parseInt(mass)
    return (
      (reaction.E1 === element && reaction.A1 === A) ||
      (reaction.E2 === element && reaction.A2 === A) ||
      (reaction.E === element && reaction.A === A)
    )
  }

  // Helper function to check if a reaction contains a specific element
  const reactionContainsElement = (reaction: FusionReaction, element: string) => {
    // Normalize both the reaction element symbols and the search element to handle D/T → H mapping
    const normalizedElement = normalizeElementSymbol(element)
    return (
      normalizeElementSymbol(reaction.E1) === normalizedElement ||
      normalizeElementSymbol(reaction.E2) === normalizedElement ||
      normalizeElementSymbol(reaction.E) === normalizedElement
    )
  }

  if (dbLoading) {
    return <DatabaseLoadingCard downloadProgress={downloadProgress} />
  }

  if (dbError) {
    return <DatabaseErrorCard error={dbError} />
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Fusion Reactions</h1>
        <p className="text-gray-600 dark:text-gray-400">Query exothermic fusion reactions where two nuclei combine to form a heavier nucleus</p>
      </div>

      {/* Query Builder */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Query Parameters</h2>

        {/* Input/Output Selectors (always visible) */}
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          {/* Input Element 1 Selection (E1) */}
          <PeriodicTableSelector
            label="Input Element 1 (E1)"
            availableElements={elements}
            selectedElements={selectedElement1}
            onSelectionChange={setSelectedElement1}
          />

          {/* Input Element 2 Selection (E2) */}
          <PeriodicTableSelector
            label="Input Element 2 (E2)"
            availableElements={elements}
            selectedElements={selectedElement2}
            onSelectionChange={setSelectedElement2}
            align="center"
          />

          {/* Output Element Selection (E) */}
          <PeriodicTableSelector
            label="Output Element (E)"
            availableElements={elements}
            selectedElements={selectedOutputElement}
            onSelectionChange={setSelectedOutputElement}
            align="right"
          />
        </div>

        {/* Additional Filters (collapsible) */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-900 dark:text-white">
              Additional Filters
            </h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary p-2"
              title={showFilters ? 'Collapse filters' : 'Expand filters'}
              aria-label={showFilters ? 'Collapse filters' : 'Expand filters'}
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="grid md:grid-cols-3 gap-6">
              {/* MeV Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Energy Range (MeV)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="input flex-1"
                    value={filter.minMeV || ''}
                    onChange={(e) => setFilter({...filter, minMeV: e.target.value ? parseFloat(e.target.value) : undefined})}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="input flex-1"
                    value={filter.maxMeV || ''}
                    onChange={(e) => setFilter({...filter, maxMeV: e.target.value ? parseFloat(e.target.value) : undefined})}
                  />
                </div>
              </div>

              {/* Neutrino Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Neutrino Involvement
                </label>
                <div className="space-y-2">
                  {['none', 'left', 'right'].map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filter.neutrinoTypes?.includes(type as any)}
                        onChange={(e) => {
                          const types = filter.neutrinoTypes || []
                          if (e.target.checked) {
                            setFilter({...filter, neutrinoTypes: [...types, type as any]})
                          } else {
                            setFilter({...filter, neutrinoTypes: types.filter(t => t !== type)})
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Result Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Result Limit
                </label>
                <input
                  type="number"
                  className="input"
                  value={filter.limit || 100}
                  onChange={(e) => setFilter({...filter, limit: parseInt(e.target.value) || 100})}
                  max={1000}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum 1000 rows</p>
              </div>
            </div>
          </div>
        </div>

        {/* SQL Preview with Reset Filters Button */}
        <div className="pt-4 px-4 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SQL Preview:</span>
            </div>
            <div className="flex items-center gap-3">
              {isQuerying && (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Querying...</span>
                </div>
              )}
              <button
                onClick={() => {
                  setFilter({
                    elements: [],
                    minMeV: undefined,
                    maxMeV: undefined,
                    neutrinoTypes: DEFAULT_NEUTRINO_TYPES as any[],
                    limit: DEFAULT_LIMIT,
                    orderBy: 'MeV',
                    orderDirection: 'desc'
                  })
                  setSelectedElement1(DEFAULT_ELEMENT1)
                  setSelectedElement2(DEFAULT_ELEMENT2)
                  setSelectedOutputElement(DEFAULT_OUTPUT_ELEMENT)
                }}
                className="btn btn-secondary px-4 py-1.5 text-sm whitespace-nowrap"
              >
                Reset Filters
              </button>
            </div>
          </div>
          <code className="text-xs text-gray-600 dark:text-gray-400 block font-mono break-all">
            {sqlPreview.replace(/\s+/g, ' ').trim()};
          </code>
        </div>
      </div>

      {/* Results */}
      {showResults && (
        <div className="space-y-6">
          {/* Heatmap Visualization */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Heatmap Visualization
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Visualize which elements appear most frequently in the query results. The color intensity represents the selected metric value, with darker/more intense colors indicating higher values.
                </p>
              </div>
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className="btn btn-secondary p-2 ml-4"
                title={showHeatmap ? 'Collapse periodic table' : 'Expand periodic table'}
                aria-label={showHeatmap ? 'Collapse periodic table' : 'Expand periodic table'}
              >
                <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showHeatmap ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showHeatmap ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="pt-4">
                {/* Metric Selector and Explanation on same row */}
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  {/* Metric Selector - Stacked label and input */}
                  <div className="flex flex-col gap-1 md:min-w-[140px]">
                    <label htmlFor="heatmap-metric-selector" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Metric:
                    </label>
                    <select
                      id="heatmap-metric-selector"
                      value={heatmapMode}
                      onChange={(e) => setHeatmapMode(e.target.value as HeatmapMode)}
                      className="input px-3 py-2 text-sm"
                      aria-label="Select heatmap metric"
                    >
                      <option value="frequency">Frequency</option>
                      <option value="energy">Energy</option>
                      <option value="diversity">Diversity</option>
                    </select>
                  </div>

                  {/* Metric Explanation */}
                  <div className="flex-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {heatmapMode === 'frequency' && (
                        <>
                          <strong>Frequency:</strong> Shows how many times each element appears across {useAllResultsForHeatmap ? `all ${totalCount.toLocaleString()} matching` : results.length.toLocaleString()} reactions (as input or output).
                          Elements that appear in more reactions have darker colors.
                        </>
                      )}
                      {heatmapMode === 'energy' && (
                        <>
                          <strong>Energy:</strong> Shows the total energy (MeV) from all reactions involving each element.
                          Elements with higher total energy output have darker colors.
                        </>
                      )}
                      {heatmapMode === 'diversity' && (
                        <>
                          <strong>Diversity:</strong> Shows how many unique isotopes of each element appear in the results.
                          Elements with more isotopic variety have darker colors.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Toggle for using all results */}
                {results.length < totalCount && (
                  <div className="mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Use all {totalCount.toLocaleString()} matching results
                        {totalCount > 1000 && <span className="text-gray-500 dark:text-gray-400"> (may be slow)</span>}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={useAllResultsForHeatmap}
                        onClick={() => {
                          const newValue = !useAllResultsForHeatmap
                          setUseAllResultsForHeatmap(newValue)
                          // Re-run query to fetch unlimited results if toggled on
                          if (newValue && db) {
                            const unlimitedQuery = { ...queryFilter, limit: undefined }
                            const unlimitedResult = queryFusion(db, unlimitedQuery)
                            setAllResults(unlimitedResult.reactions)
                          } else {
                            setAllResults([])
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                          useAllResultsForHeatmap
                            ? 'bg-blue-600'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useAllResultsForHeatmap ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                )}

                <PeriodicTable
                  availableElements={resultElements}
                  selectedElement={highlightedElement}
                  onElementClick={(symbol) => {
                    // Toggle pin state if clicking same element, otherwise pin new element
                    if (pinnedElement && highlightedElement === symbol) {
                      // Unpinning element
                      setPinnedElement(false)
                      setHighlightedElement(null)
                    } else {
                      // Pinning element
                      setPinnedElement(true)
                      setHighlightedElement(symbol)
                    }
                  }}
                  heatmapData={heatmapMetrics[heatmapMode]}
                  heatmapMode={heatmapMode}
                  showHeatmap={showHeatmap}
                />
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {results.length === totalCount
                    ? `Showing all ${totalCount.toLocaleString()} matching reactions`
                    : `Showing ${results.length.toLocaleString()} of ${totalCount.toLocaleString()} matching reactions`
                  }
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Query executed in {executionTime.toFixed(2)}ms
                  {results.length < totalCount && (
                    <span className="ml-2">• Increase limit to see more results</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowBosonFermion(!showBosonFermion)}
                  className="btn btn-secondary px-4 py-2 text-sm"
                  title={showBosonFermion ? 'Hide Boson/Fermion columns' : 'Show Boson/Fermion columns'}
                >
                  {showBosonFermion ? <EyeOff className="w-4 h-4 mr-2 inline" /> : <Eye className="w-4 h-4 mr-2 inline" />}
                  {showBosonFermion ? 'Hide' : 'Show'} B/F Types
                </button>
                <button
                  onClick={exportToCSV}
                  className="btn btn-secondary px-4 py-2 text-sm"
                  disabled={results.length === 0}
                >
                  <Download className="w-4 h-4 mr-2 inline" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="table-container -mx-6 sm:mx-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th colSpan={2} className="bg-blue-50 dark:bg-blue-900/30">Inputs</th>
                    <th rowSpan={2} className="bg-green-50 dark:bg-green-900/30">Output</th>
                    <th rowSpan={2}>Energy<br/>(MeV)</th>
                    <th rowSpan={2}>Neutrino</th>
                    {showBosonFermion && (
                      <>
                        <th colSpan={2} className="bg-purple-50 dark:bg-purple-900/30">Input 1 Type</th>
                        <th colSpan={2} className="bg-purple-50 dark:bg-purple-900/30">Input 2 Type</th>
                        <th colSpan={2} className="bg-amber-50 dark:bg-amber-900/30">Output Type</th>
                      </>
                    )}
                  </tr>
                  <tr>
                    <th className="bg-blue-50 dark:bg-blue-900/30">Input 1</th>
                    <th className="bg-blue-50 dark:bg-blue-900/30">Input 2</th>
                    {showBosonFermion && (
                      <>
                        <th>Nuclear</th>
                        <th>Atomic</th>
                        <th>Nuclear</th>
                        <th>Atomic</th>
                        <th>Nuclear</th>
                        <th>Atomic</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {results.map((reaction, idx) => {
                    // Determine if this row should be desaturated
                    const activeNuclide = pinnedNuclide ? highlightedNuclide : highlightedNuclide
                    const activeElement = pinnedElement ? highlightedElement : highlightedElement
                    const nuclideMatch = !activeNuclide || reactionContainsNuclide(reaction, activeNuclide)
                    const elementMatch = !activeElement || reactionContainsElement(reaction, activeElement)
                    const isDesaturated = (activeNuclide && !nuclideMatch) || (activeElement && !elementMatch)

                    // Check radioactivity for each isotope (O(1) Set lookup instead of SQL query)
                    const isE1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                    const isE2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)
                    const isOutputRadioactive = radioactiveNuclides.has(`${reaction.Z}-${reaction.A}`)

                    return (
                    <tr key={idx} className={isDesaturated ? 'opacity-30 grayscale' : 'transition-all duration-200'}>
                      <td className="bg-blue-50 dark:bg-blue-900/30 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/element-data?Z=${reaction.Z1}&A=${reaction.A1}`}
                            className="font-semibold text-base hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {reaction.E1}-{reaction.A1}
                          </Link>
                          {isE1Radioactive && (
                            <span title="Radioactive">
                              <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z1})</div>
                      </td>
                      <td className="bg-blue-50 dark:bg-blue-900/30 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/element-data?Z=${reaction.Z2}&A=${reaction.A2}`}
                            className="font-semibold text-base hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {reaction.E2}-{reaction.A2}
                          </Link>
                          {isE2Radioactive && (
                            <span title="Radioactive">
                              <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z2})</div>
                      </td>
                      <td className="bg-green-50 dark:bg-green-900/30 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/element-data?Z=${reaction.Z}&A=${reaction.A}`}
                            className="font-semibold text-base hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {reaction.E}-{reaction.A}
                          </Link>
                          {isOutputRadioactive && (
                            <span title="Radioactive">
                              <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z})</div>
                      </td>
                      <td className="text-green-600 font-semibold">{reaction.MeV.toFixed(2)}</td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          reaction.neutrino === 'none' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' :
                          reaction.neutrino === 'left' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                          'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        }`}>
                          {reaction.neutrino === 'none' ? 'None' :
                           reaction.neutrino === 'left' ? 'Left' : 'Right'}
                        </span>
                      </td>
                      {showBosonFermion && (
                        <>
                          <td className="bg-purple-50 dark:bg-purple-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.nBorF1 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.nBorF1 === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-purple-50 dark:bg-purple-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.aBorF1 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.aBorF1 === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-purple-50 dark:bg-purple-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.nBorF2 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.nBorF2 === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-purple-50 dark:bg-purple-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.aBorF2 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.aBorF2 === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-amber-50 dark:bg-amber-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.nBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.nBorF === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-amber-50 dark:bg-amber-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.aBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.aBorF === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nuclides Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Nuclides Appearing in Results ({filteredNuclides.length}{pinnedElement && highlightedElement ? ` of ${nuclides.length} - showing ${highlightedElement} isotopes` : ''})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filteredNuclides.map(nuc => {
                const nuclideId = `${nuc.E}-${nuc.A}`
                const isActive = highlightedNuclide === nuclideId
                const isPinned = pinnedNuclide && highlightedNuclide === nuclideId
                const isDesaturated = highlightedNuclide && highlightedNuclide !== nuclideId
                const nuclideIsRadioactive = radioactiveNuclides.has(`${nuc.Z}-${nuc.A}`)

                return (
                <div
                  key={nuc.id}
                  className={`px-3 py-2 rounded border cursor-pointer transition-all duration-200 ${
                    isPinned ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400' :
                    isActive ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' :
                    isDesaturated ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-40' :
                    'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onMouseEnter={() => !pinnedNuclide && setHighlightedNuclide(nuclideId)}
                  onMouseLeave={() => !pinnedNuclide && setHighlightedNuclide(null)}
                  onClick={() => {
                    if (pinnedNuclide && highlightedNuclide === nuclideId) {
                      // Unpinning nuclide only - do NOT unpin parent element
                      // This allows element to remain pinned independently
                      setPinnedNuclide(false)
                      setHighlightedNuclide(null)
                    } else {
                      // Pinning nuclide - also pin its parent element
                      const [elementSymbol] = nuclideId.split('-')
                      setPinnedNuclide(true)
                      setHighlightedNuclide(nuclideId)
                      setPinnedElement(true)
                      setHighlightedElement(normalizeElementSymbol(elementSymbol))
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{nuc.E}-{nuc.A}</span>
                    {nuclideIsRadioactive && (
                      <span title="Radioactive">
                        <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Z={nuc.Z}</div>
                </div>
                )
              })}
            </div>
          </div>

          {/* Details Section */}
          {(selectedElementDetails || selectedNuclideDetails) ? (
            <div className="space-y-6">
              {selectedElementDetails && (
                <ElementDetailsCard
                  element={selectedElementDetails}
                  atomicRadii={selectedElementRadii}
                  onClose={() => {
                    setPinnedElement(false)
                    setHighlightedElement(null)
                  }}
                />
              )}
              {selectedNuclideDetails && (
                <NuclideDetailsCard
                  nuclide={selectedNuclideDetails}
                  onClose={() => {
                    // Unpin nuclide only, keep element pinned
                    setPinnedNuclide(false)
                    setHighlightedNuclide(null)
                  }}
                />
              )}
            </div>
          ) : (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Details
              </h3>
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">Click on a nuclide or element above to see detailed properties</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
