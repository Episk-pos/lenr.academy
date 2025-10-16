import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Download, Info, Loader2, Eye, EyeOff, Radiation } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import type { TwoToTwoReaction, QueryFilter, Element, Nuclide, AtomicRadiiData } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { queryTwoToTwo, getAllElements, getElementBySymbol, getNuclideBySymbol, getAtomicRadii } from '../services/queryService'
import { normalizeElementSymbol } from '../utils/formatUtils'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import ElementDetailsCard from '../components/ElementDetailsCard'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'
import { VirtualizedList } from '../components/VirtualizedList'

// Default values
const DEFAULT_ELEMENT1 = ['D']
const DEFAULT_ELEMENT2 = ['Ni', 'Li', 'Al', 'B', 'N']
const DEFAULT_OUTPUT_ELEMENT3 = ['C']
const DEFAULT_OUTPUT_ELEMENT4: string[] = []
const DEFAULT_NEUTRINO_TYPES = ['none', 'left', 'right']
const DEFAULT_LIMIT = 100
const SCROLLBAR_COMPENSATION = 16
const SMALL_RESULT_THRESHOLD = 12

export default function TwoToTwoQuery() {
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

  const getInitialOutputElement3 = () => {
    const param = searchParams.get('e3')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_OUTPUT_ELEMENT3
  }

  const getInitialOutputElement4 = () => {
    const param = searchParams.get('e4')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_OUTPUT_ELEMENT4
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

  const [results, setResults] = useState<TwoToTwoReaction[]>([])
  const [showResults, setShowResults] = useState(false)
  const [selectedElement1, setSelectedElement1] = useState<string[]>(getInitialElement1())
  const [selectedElement2, setSelectedElement2] = useState<string[]>(getInitialElement2())
  const [selectedOutputElement3, setSelectedOutputElement3] = useState<string[]>(getInitialOutputElement3())
  const [selectedOutputElement4, setSelectedOutputElement4] = useState<string[]>(getInitialOutputElement4())
  const [resultElements, setResultElements] = useState<Element[]>([])
  const [nuclides, setNuclides] = useState<Nuclide[]>([])
  const [radioactiveNuclides, setRadioactiveNuclides] = useState<Set<string>>(new Set())
  const [executionTime, setExecutionTime] = useState<number>(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isQuerying, setIsQuerying] = useState(false)

  // Boson/Fermion toggle - default to off for TwoToTwo (too many columns)
  const [showBosonFermion, setShowBosonFermion] = useState(() => {
    const saved = localStorage.getItem('showBosonFermion_twotwo')
    if (saved !== null) return JSON.parse(saved)
    // Default to hide (off) for TwoToTwo - 8 B/F columns is too much
    return false
  })

  const tableContainerRef = useRef<HTMLDivElement | null>(null)
  const [twoTwoViewportHeight, setTwoTwoViewportHeight] = useState<number | null>(null)

  const updateTwoTwoViewportHeight = useCallback(() => {
    if (!tableContainerRef.current) return
    const rect = tableContainerRef.current.getBoundingClientRect()
    const padding = 120
    const available = Math.max(220, window.innerHeight - rect.top - padding)
    setTwoTwoViewportHeight(available)
  }, [])

  useEffect(() => {
    updateTwoTwoViewportHeight()
  }, [updateTwoTwoViewportHeight, results.length, showBosonFermion])

  useEffect(() => {
    window.addEventListener('resize', updateTwoTwoViewportHeight)
    return () => window.removeEventListener('resize', updateTwoTwoViewportHeight)
  }, [updateTwoTwoViewportHeight])

  const twoTwoColumnTemplate = useMemo(() => {
    if (showBosonFermion) {
      return 'repeat(4, minmax(150px, 1fr)) repeat(10, minmax(120px, 0.9fr))'
    }
    return 'repeat(4, minmax(170px, 1fr)) minmax(140px, 1fr) minmax(140px, 1fr)'
  }, [showBosonFermion])

  const twoTwoMinWidth = useMemo(() => (showBosonFermion ? 1800 : 960), [showBosonFermion])

  const twoTwoEstimatedRowHeight = useMemo(() => (showBosonFermion ? 110 : 92), [showBosonFermion])
  const twoTwoCompactRowHeight = useMemo(() => (showBosonFermion ? 92 : 82), [showBosonFermion])

  const twoTwoBaseListHeight = useMemo(() => {
    if (results.length === 0) {
      return 160
    }
    if (results.length <= SMALL_RESULT_THRESHOLD) {
      // For small result sets, use exact height without padding
      return results.length * twoTwoCompactRowHeight
    }
    const preferred = results.length * twoTwoEstimatedRowHeight
    const min = Math.max(twoTwoEstimatedRowHeight * Math.min(results.length, 4), 280)
    const max = 640
    return Math.min(max, Math.max(min, preferred))
  }, [results.length, twoTwoCompactRowHeight, twoTwoEstimatedRowHeight])

  const twoTwoListHeight = useMemo(() => {
    // For small result sets, don't enforce a minimum height or viewport constraint
    if (results.length <= SMALL_RESULT_THRESHOLD && results.length > 0) {
      return twoTwoBaseListHeight
    }
    const minHeight = 220
    const base = Math.max(minHeight, twoTwoBaseListHeight)
    if (twoTwoViewportHeight == null) {
      return base
    }
    return Math.max(minHeight, Math.min(base, twoTwoViewportHeight))
  }, [twoTwoBaseListHeight, twoTwoViewportHeight, results.length])

  const twoTwoUsesScrollbar = twoTwoListHeight < twoTwoBaseListHeight
  const twoTwoHeaderPadding = !showBosonFermion && twoTwoUsesScrollbar ? SCROLLBAR_COMPENSATION : 0

  const [highlightedNuclide, setHighlightedNuclide] = useState<string | null>(null)
  const [pinnedNuclide, setPinnedNuclide] = useState(false)
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null)
  const [pinnedElement, setPinnedElement] = useState(false)
  const [selectedElementDetails, setSelectedElementDetails] = useState<Element | null>(null)
  const [selectedNuclideDetails, setSelectedNuclideDetails] = useState<Nuclide | null>(null)
  const [selectedElementRadii, setSelectedElementRadii] = useState<AtomicRadiiData | null>(null)
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false)

  // Load elements when database is ready
  useEffect(() => {
    if (db) {
      const allElements = getAllElements(db)
      setElements(allElements)
      setIsInitialized(true)
    }
  }, [db])

  // Save B/F toggle to localStorage (separate key for TwoToTwo)
  useEffect(() => {
    localStorage.setItem('showBosonFermion_twotwo', JSON.stringify(showBosonFermion))
  }, [showBosonFermion])

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

  // Update URL when filters change
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

    if (selectedOutputElement3.length > 0 && JSON.stringify(selectedOutputElement3) !== JSON.stringify(DEFAULT_OUTPUT_ELEMENT3)) {
      params.set('e3', selectedOutputElement3.join(','))
    } else if (selectedOutputElement3.length > 0) {
      // Include default to distinguish from "any"
      params.set('e3', selectedOutputElement3.join(','))
    }

    if (selectedOutputElement4.length > 0) {
      params.set('e4', selectedOutputElement4.join(','))
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
  }, [selectedElement1, selectedElement2, selectedOutputElement3, selectedOutputElement4, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit, pinnedElement, highlightedElement, pinnedNuclide, highlightedNuclide, isInitialized, showResults, searchParams])

  // Auto-execute query when filters change
  useEffect(() => {
    if (db && isInitialized) {
      handleQuery()
    }
  }, [db, selectedElement1, selectedElement2, selectedOutputElement3, selectedOutputElement4, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit, isInitialized])

  const handleQuery = () => {
    if (!db) return

    setIsQuerying(true)
    try {
      // Build filter with selected elements
      const allSelectedElements = [...selectedElement1, ...selectedElement2]
      const queryFilter: QueryFilter = {
        ...filter,
        elements: allSelectedElements.length > 0 ? allSelectedElements : undefined,
        element1List: selectedElement1.length > 0 ? selectedElement1 : undefined,
        element2List: selectedElement2.length > 0 ? selectedElement2 : undefined,
        outputElement3List: selectedOutputElement3.length > 0 ? selectedOutputElement3 : undefined,
        outputElement4List: selectedOutputElement4.length > 0 ? selectedOutputElement4 : undefined
      }

      const result = queryTwoToTwo(db, queryFilter)

      setResults(result.reactions)
      setResultElements(result.elements)
      setNuclides(result.nuclides)
      setRadioactiveNuclides(result.radioactiveNuclides)
      setExecutionTime(result.executionTime)
      setTotalCount(result.totalCount)
      setShowResults(true)
    } catch (error) {
      console.error('Query failed:', error)
      alert('Query failed: ' + (error as Error).message)
    } finally {
      setIsQuerying(false)
    }
  }

  const exportToCSV = () => {
    if (results.length === 0) return

    const headers = ['E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'E3', 'Z3', 'A3', 'E4', 'Z4', 'A4', 'MeV', 'neutrino']
    const csvContent = [
      headers.join(','),
      ...results.map(r => [
        r.E1, r.Z1, r.A1, r.E2, r.Z2, r.A2, r.E3, r.Z3, r.A3, r.E4, r.Z4, r.A4, r.MeV, r.neutrino
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `twotwo_reactions_${Date.now()}.csv`
    a.click()
  }

  // Helper function to check if a reaction contains a specific nuclide
  const reactionContainsNuclide = (reaction: TwoToTwoReaction, nuclide: string) => {
    const [element, mass] = nuclide.split('-')
    const A = parseInt(mass)
    return (
      (reaction.E1 === element && reaction.A1 === A) ||
      (reaction.E2 === element && reaction.A2 === A) ||
      (reaction.E3 === element && reaction.A3 === A) ||
      (reaction.E4 === element && reaction.A4 === A)
    )
  }

  // Helper function to check if a reaction contains a specific element
  const reactionContainsElement = (reaction: TwoToTwoReaction, element: string) => {
    // Normalize both the reaction element symbols and the search element to handle D/T → H mapping
    const normalizedElement = normalizeElementSymbol(element)
    return (
      normalizeElementSymbol(reaction.E1) === normalizedElement ||
      normalizeElementSymbol(reaction.E2) === normalizedElement ||
      normalizeElementSymbol(reaction.E3) === normalizedElement ||
      normalizeElementSymbol(reaction.E4) === normalizedElement
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Two-To-Two Reactions</h1>
        <p className="text-gray-600 dark:text-gray-400">Query 2-2 transmutation reactions where two input nuclei transform into two different output nuclei</p>
      </div>

      {/* Query Builder */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Query Parameters</h2>

        <div className="grid md:grid-cols-4 gap-6">
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
          />

          {/* Output Element 1 Selection (E3) */}
          <PeriodicTableSelector
            label="Output Element 1 (E3)"
            availableElements={elements}
            selectedElements={selectedOutputElement3}
            onSelectionChange={setSelectedOutputElement3}
          />

          {/* Output Element 2 Selection (E4) */}
          <PeriodicTableSelector
            label="Output Element 2 (E4)"
            availableElements={elements}
            selectedElements={selectedOutputElement4}
            onSelectionChange={setSelectedOutputElement4}
            align="right"
          />

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
              setSelectedOutputElement3(DEFAULT_OUTPUT_ELEMENT3)
              setSelectedOutputElement4(DEFAULT_OUTPUT_ELEMENT4)
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

        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">SQL Preview:</span>
          </div>
          <code className="text-xs text-gray-600 dark:text-gray-400 block font-mono whitespace-pre-wrap">
            SELECT * FROM TwoToTwoAll
            {(selectedElement1.length > 0 || selectedElement2.length > 0 || selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0 || filter.minMeV !== undefined || filter.maxMeV !== undefined) && ' WHERE '}
            {selectedElement1.length > 0 && `E1 IN (${selectedElement1.map(e => `'${e}'`).join(', ')})`}
            {selectedElement1.length > 0 && (selectedElement2.length > 0 || selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0) && ' AND '}
            {selectedElement2.length > 0 && `E2 IN (${selectedElement2.map(e => `'${e}'`).join(', ')})`}
            {selectedElement2.length > 0 && (selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0) && ' AND '}
            {selectedOutputElement3.length > 0 && `E3 IN (${selectedOutputElement3.map(e => `'${e}'`).join(', ')})`}
            {selectedOutputElement3.length > 0 && selectedOutputElement4.length > 0 && ' AND '}
            {selectedOutputElement4.length > 0 && `E4 IN (${selectedOutputElement4.map(e => `'${e}'`).join(', ')})`}
            {(selectedElement1.length > 0 || selectedElement2.length > 0 || selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0) && filter.minMeV !== undefined && ' AND '}
            {filter.minMeV !== undefined && `MeV >= ${filter.minMeV}`}
            {filter.maxMeV !== undefined && ` AND MeV <= ${filter.maxMeV}`}
            {` ORDER BY MeV ${filter.orderDirection?.toUpperCase()} LIMIT ${filter.limit || 100}`}
          </code>
        </div>
      </div>

      {/* Results */}
      {showResults && (
        <div className="space-y-6">
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
              aria-label="Two-to-two reaction results"
            >
              <div className="min-w-full" style={{ minWidth: twoTwoMinWidth }}>
                <div
                  className="sticky top-0 z-10"
                  style={{ paddingRight: twoTwoHeaderPadding }}
                >
                  <div
                    className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                    style={{ gridTemplateColumns: twoTwoColumnTemplate }}
                  >
                    <div className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/30 col-span-2">
                      Inputs
                    </div>
                    <div className="px-3 py-2 text-center bg-green-50 dark:bg-green-900/30 col-span-2">
                      Outputs
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
                          Output 1 Type
                        </div>
                        <div className="px-3 py-2 text-center bg-amber-50 dark:bg-amber-900/30 col-span-2">
                          Output 2 Type
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                    style={{ gridTemplateColumns: twoTwoColumnTemplate }}
                  >
                    <div className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/30">Input 1</div>
                    <div className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/30">Input 2</div>
                    <div className="px-3 py-2 text-center bg-green-50 dark:bg-green-900/30">Output 1</div>
                    <div className="px-3 py-2 text-center bg-green-50 dark:bg-green-900/30">Output 2</div>
                    <div className="px-3 py-2 text-center">Energy</div>
                    <div className="px-3 py-2 text-center">Neutrino</div>
                    {showBosonFermion && (
                      <>
                        <div className="px-3 py-2 text-center">Nuclear</div>
                        <div className="px-3 py-2 text-center">Atomic</div>
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
                    Run a query to view two-to-two reactions.
                  </div>
                ) : results.length <= SMALL_RESULT_THRESHOLD ? (
                  <div style={{ paddingRight: twoTwoHeaderPadding }}>
                    {results.map((reaction, index) => {
                        const activeNuclide = pinnedNuclide ? highlightedNuclide : highlightedNuclide
                        const activeElement = pinnedElement ? highlightedElement : highlightedElement
                        const nuclideMatch = !activeNuclide || reactionContainsNuclide(reaction, activeNuclide)
                        const elementMatch = !activeElement || reactionContainsElement(reaction, activeElement)
                        const isDesaturated = (activeNuclide && !nuclideMatch) || (activeElement && !elementMatch)

                        const isE1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                        const isE2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)
                        const isE3Radioactive = radioactiveNuclides.has(`${reaction.Z3}-${reaction.A3}`)
                        const isE4Radioactive = radioactiveNuclides.has(`${reaction.Z4}-${reaction.A4}`)

                        return (
                          <div
                            className={`grid border-b border-gray-200 dark:border-gray-700 transition-colors duration-150 ${
                              isDesaturated ? 'opacity-30 grayscale' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                            }`}
                            style={{ gridTemplateColumns: twoTwoColumnTemplate }}
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
                                to={`/element-data?Z=${reaction.Z3}&A=${reaction.A3}`}
                                className="font-semibold text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E3}-{reaction.A3}
                              </Link>
                              {isE3Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z3})</div>
                          </div>
                          <div className="px-3 py-3 bg-green-50 dark:bg-green-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z4}&A=${reaction.A4}`}
                                className="font-semibold text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E4}-{reaction.A4}
                              </Link>
                              {isE4Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z4})</div>
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
                                    reaction.nBorF3 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF3 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.aBorF3 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.aBorF3 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.nBorF4 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF4 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.aBorF4 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                 {reaction.aBorF4 === 'b' ? 'Boson' : 'Fermion'}
                               </span>
                             </div>
                           </>
                          )}
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <div style={{ paddingRight: twoTwoHeaderPadding }}>
                    <VirtualizedList
                      items={results}
                      estimatedRowHeight={twoTwoEstimatedRowHeight}
                      height={twoTwoListHeight}
                      overscanRowCount={6}
                      className="relative"
                      ariaLabel="Two-to-two reaction results"
                    >
                      {(reaction) => {
                        const activeNuclide = pinnedNuclide ? highlightedNuclide : highlightedNuclide
                        const activeElement = pinnedElement ? highlightedElement : highlightedElement
                        const nuclideMatch = !activeNuclide || reactionContainsNuclide(reaction, activeNuclide)
                        const elementMatch = !activeElement || reactionContainsElement(reaction, activeElement)
                        const isDesaturated = (activeNuclide && !nuclideMatch) || (activeElement && !elementMatch)

                        const isE1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                        const isE2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)
                        const isE3Radioactive = radioactiveNuclides.has(`${reaction.Z3}-${reaction.A3}`)
                        const isE4Radioactive = radioactiveNuclides.has(`${reaction.Z4}-${reaction.A4}`)

                        return (
                          <div
                            className={`grid border-b border-gray-200 dark:border-gray-700 transition-colors duration-150 ${
                              isDesaturated ? 'opacity-30 grayscale' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                            }`}
                            style={{ gridTemplateColumns: twoTwoColumnTemplate }}
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
                                to={`/element-data?Z=${reaction.Z3}&A=${reaction.A3}`}
                                className="font-semibold text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E3}-{reaction.A3}
                              </Link>
                              {isE3Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z3})</div>
                          </div>
                          <div className="px-3 py-3 bg-green-50 dark:bg-green-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z4}&A=${reaction.A4}`}
                                className="font-semibold text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E4}-{reaction.A4}
                              </Link>
                              {isE4Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z4})</div>
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
                                    reaction.nBorF3 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF3 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.aBorF3 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.aBorF3 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.nBorF4 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF4 === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-3 py-3 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    reaction.aBorF4 === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                 {reaction.aBorF4 === 'b' ? 'Boson' : 'Fermion'}
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
