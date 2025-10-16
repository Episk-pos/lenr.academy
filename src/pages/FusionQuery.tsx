import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Download, Info, Loader2, Eye, EyeOff, Radiation } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import type { FusionReaction, QueryFilter, Nuclide, Element, AtomicRadiiData } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { queryFusion, getAllElements, getElementBySymbol, getNuclideBySymbol, getAtomicRadii, getFusionSqlPreview } from '../services/queryService'
import { normalizeElementSymbol } from '../utils/formatUtils'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import ElementDetailsCard from '../components/ElementDetailsCard'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'
import { VirtualizedList } from '../components/VirtualizedList'

// Default values
const DEFAULT_ELEMENT1 = ['H']
const DEFAULT_ELEMENT2 = ['C', 'O']
const DEFAULT_OUTPUT_ELEMENT: string[] = []
const DEFAULT_NEUTRINO_TYPES = ['none', 'left', 'right']
const DEFAULT_LIMIT = 100
const SMALL_RESULT_THRESHOLD = 12
const SCROLLBAR_COMPENSATION = 16

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

  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const [fusionViewportHeight, setFusionViewportHeight] = useState<number | null>(null)

  const updateFusionViewportHeight = useCallback(() => {
    if (!tableContainerRef.current) return
    const rect = tableContainerRef.current.getBoundingClientRect()
    const padding = 120
    const available = Math.max(220, window.innerHeight - rect.top - padding)
    setFusionViewportHeight(available)
  }, [])

  useEffect(() => {
    updateFusionViewportHeight()
  }, [updateFusionViewportHeight, results.length, showBosonFermion])

  useEffect(() => {
    window.addEventListener('resize', updateFusionViewportHeight)
    return () => window.removeEventListener('resize', updateFusionViewportHeight)
  }, [updateFusionViewportHeight])

  const fusionColumnTemplate = useMemo(() => {
    if (showBosonFermion) {
      return 'minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) repeat(6, minmax(120px, 0.9fr))'
    }
    return 'minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(140px, 0.8fr) minmax(140px, 0.8fr)'
  }, [showBosonFermion])

  const fusionMinWidth = useMemo(() => (showBosonFermion ? 1500 : 900), [showBosonFermion])

  const fusionEstimatedRowHeight = useMemo(() => (showBosonFermion ? 96 : 82), [showBosonFermion])
  const fusionCompactRowHeight = useMemo(() => (showBosonFermion ? 76 : 68), [showBosonFermion])
  const fusionBaseListHeight = useMemo(() => {
    if (results.length === 0) {
      return 160
    }
    if (results.length <= SMALL_RESULT_THRESHOLD) {
      return results.length * fusionCompactRowHeight + 12
    }
    const preferred = results.length * fusionEstimatedRowHeight
    const min = Math.max(fusionEstimatedRowHeight * Math.min(results.length, 4), 260)
    const max = 640
    return Math.min(max, Math.max(min, preferred))
  }, [fusionCompactRowHeight, fusionEstimatedRowHeight, results.length])

  const fusionListHeight = useMemo(() => {
    const minHeight = 220
    const base = Math.max(minHeight, fusionBaseListHeight)
    if (fusionViewportHeight == null) {
      return base
    }
    return Math.max(minHeight, Math.min(base, fusionViewportHeight))
  }, [fusionBaseListHeight, fusionViewportHeight])

  const fusionUsesScrollbar = fusionListHeight < fusionBaseListHeight
  const fusionHeaderPadding = !showBosonFermion && fusionUsesScrollbar ? SCROLLBAR_COMPENSATION : 0
  const [highlightedNuclide, setHighlightedNuclide] = useState<string | null>(null)
  const [pinnedNuclide, setPinnedNuclide] = useState(false)
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null)
  const [pinnedElement, setPinnedElement] = useState(false)
  const [selectedElementDetails, setSelectedElementDetails] = useState<Element | null>(null)
  const [selectedNuclideDetails, setSelectedNuclideDetails] = useState<Nuclide | null>(null)
  const [selectedElementRadii, setSelectedElementRadii] = useState<AtomicRadiiData | null>(null)
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false)

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
      // Pinning nuclide from URL - also pin its parent element
      const [elementSymbol] = pinN.split('-')
      setHighlightedNuclide(pinN)
      setPinnedNuclide(true)
      setHighlightedElement(normalizeElementSymbol(elementSymbol))
      setPinnedElement(true)
      setHasInitializedFromUrl(true)
    } else if (pinE && !pinnedElement && resultElements.some(el => el.E === pinE)) {
      // Only pin element if no nuclide is being pinned
      setHighlightedElement(pinE)
      setPinnedElement(true)
      setHasInitializedFromUrl(true)
    } else if (!pinE && !pinN) {
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

        <div className="grid md:grid-cols-3 gap-6">
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

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
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
            className="btn btn-secondary px-6 py-2"
          >
            Reset Filters
          </button>
          {isQuerying && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Querying...</span>
            </div>
          )}
        </div>

        {/* SQL Preview */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SQL Preview:</span>
          </div>
          <code className="text-xs text-gray-600 dark:text-gray-400 block font-mono whitespace-pre-wrap">
            {`${sqlPreview};`}
          </code>
        </div>
      </div>

      {/* Results */}
      {showResults && (
        <div className="space-y-6">
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
              <div className="flex gap-2">
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

            <div
              ref={tableContainerRef}
              className="table-container -mx-6 sm:mx-0"
              role="region"
              aria-label="Fusion reaction results"
            >
              <div className="min-w-full" style={{ minWidth: fusionMinWidth }}>
                <div
                  className="sticky top-0 z-10"
                  style={{ paddingRight: fusionHeaderPadding }}
                >
                  <div
                    className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                    style={{ gridTemplateColumns: fusionColumnTemplate, borderLeft: 'none', borderRight: 'none' }}
                  >
                    <div className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/30 col-span-2">
                      Inputs
                    </div>
                    <div className="px-3 py-2 text-center bg-green-50 dark:bg-green-900/30">
                      Output
                    </div>
                    <div className="px-3 py-2 text-center">Energy (MeV)</div>
                    <div className="px-3 py-2 text-center">Neutrino</div>
                    {showBosonFermion && (
                      <>
                        <div className="px-3 py-2 text-center bg-purple-50 dark:bg-purple-900/30 col-span-2">
                          Input 1 Type
                        </div>
                        <div className="px-3 py-2 text-center bg-purple-50 dark:bg-purple-900/30 col-span-2">
                          Input 2 Type
                        </div>
                        <div className="px-3 py-2 text-center bg-amber-50 dark:bg-amber-900/30 col-span-2">
                          Output Type
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                    style={{ gridTemplateColumns: fusionColumnTemplate, borderLeft: 'none', borderRight: 'none' }}
                  >
                    <div className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/30">Input 1</div>
                    <div className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/30">Input 2</div>
                    <div className="px-3 py-2 text-center bg-green-50 dark:bg-green-900/30">Output</div>
                    <div className="px-3 py-2 text-center" aria-hidden="true">&nbsp;</div>
                    <div className="px-3 py-2 text-center" aria-hidden="true">&nbsp;</div>
                    {showBosonFermion && (
                      <>
                        <div className="px-3 py-2 text-center">Nuclear</div>
                        <div className="px-3 py-2 text-center">Atomic</div>
                        <div className="px-3 py-2 text-center">Nuclear</div>
                        <div className="px-3 py-2 text-center">Atomic</div>
                        <div className="px-3 py-2 text-center">Nuclear</div>
                        <div className="px-3 py-2 text-center">Atomic</div>
                      </>
                    )}
                  </div>
                </div>

                {results.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Run a query to view fusion reactions.
                  </div>
                ) : (
                  <div style={{ paddingRight: fusionHeaderPadding }}>
                    <VirtualizedList
                      items={results}
                      estimatedRowHeight={fusionEstimatedRowHeight}
                      height={fusionListHeight}
                      overscanRowCount={6}
                      className="relative"
                      ariaLabel="Fusion reaction results"
                    >
                      {(reaction) => {
                      const activeNuclide = pinnedNuclide ? highlightedNuclide : highlightedNuclide
                      const activeElement = pinnedElement ? highlightedElement : highlightedElement
                      const nuclideMatch = !activeNuclide || reactionContainsNuclide(reaction, activeNuclide)
                      const elementMatch = !activeElement || reactionContainsElement(reaction, activeElement)
                      const isDesaturated = (activeNuclide && !nuclideMatch) || (activeElement && !elementMatch)

                      const isE1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                      const isE2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)
                      const isOutputRadioactive = radioactiveNuclides.has(`${reaction.Z}-${reaction.A}`)

                      return (
                        <div
                          className={`grid border-b border-gray-200 dark:border-gray-700 transition-colors duration-150 ${
                            isDesaturated ? 'opacity-30 grayscale' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                          }`}
                          style={{ gridTemplateColumns: fusionColumnTemplate, borderLeft: 'none', borderRight: 'none' }}
                        >
                          <div className="px-3 py-3 bg-blue-50 dark:bg-blue-900/20 text-center">
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
                          </div>
                          <div className="px-3 py-3 bg-blue-50 dark:bg-blue-900/20 text-center">
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
                          </div>
                          <div className="px-3 py-3 bg-green-50 dark:bg-green-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z}&A=${reaction.A}`}
                                className="font-semibold text-base hover:underline text-green-600 dark:text-green-400"
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
                          </div>
                          <div className="px-3 py-3 text-center">
                            <span className="font-semibold text-green-600 dark:text-green-300">{reaction.MeV.toFixed(2)}</span>
                          </div>
                          <div className="px-3 py-3 text-center">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                reaction.neutrino === 'none'
                                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  : reaction.neutrino === 'left'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              }`}
                            >
                              {reaction.neutrino === 'none' ? 'None' : reaction.neutrino === 'left' ? 'Left' : 'Right'}
                            </span>
                          </div>
                          {showBosonFermion && (
                            <>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.nBorF1 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF1 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.aBorF1 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.aBorF1 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.nBorF2 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF2 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.aBorF2 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.aBorF2 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.nBorF === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.aBorF === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                 {reaction.aBorF === 'b' ? 'Boson' : 'Fermion'}
                               </span>
                             </div>
                           </>
                          )}
                        </div>
                      )
                    }}
                  </VirtualizedList>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nuclides Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Nuclides Appearing in Results ({nuclides.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {nuclides.map(nuc => {
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

          {/* Elements Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Elements Appearing in Results ({resultElements.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {resultElements.map(el => {
                const elementId = el.E
                const isActive = highlightedElement === elementId
                const isPinned = pinnedElement && highlightedElement === elementId
                const isDesaturated = highlightedElement && highlightedElement !== elementId

                return (
                <div
                  key={el.Z}
                  className={`px-3 py-2 rounded border cursor-pointer transition-all duration-200 ${
                    isPinned ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400' :
                    isActive ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' :
                    isDesaturated ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 opacity-40' :
                    'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                  }`}
                  onMouseEnter={() => !pinnedElement && setHighlightedElement(elementId)}
                  onMouseLeave={() => !pinnedElement && setHighlightedElement(null)}
                  onClick={() => {
                    if (pinnedElement && highlightedElement === elementId) {
                      // Unpinning element only - do NOT unpin child nuclides
                      // This allows nuclides to remain pinned independently
                      setPinnedElement(false)
                      setHighlightedElement(null)
                    } else {
                      // Pinning element (without selecting a specific nuclide)
                      // If a nuclide from a DIFFERENT element is pinned, unpin it first
                      if (pinnedNuclide && highlightedNuclide) {
                        const [nuclideParentElement] = highlightedNuclide.split('-')
                        if (normalizeElementSymbol(nuclideParentElement) !== elementId) {
                          setPinnedNuclide(false)
                          setHighlightedNuclide(null)
                        }
                      }
                      setPinnedElement(true)
                      setHighlightedElement(elementId)
                    }
                  }}
                >
                  <div className="font-bold text-lg text-blue-900 dark:text-blue-200">{el.E}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">{el.EName}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">Z={el.Z}</div>
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
