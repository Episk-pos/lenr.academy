import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Download, Info, Loader2, Eye, EyeOff, Radiation, ChevronDown } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import type { TwoToTwoReaction, QueryFilter, Element, Nuclide, HeatmapMode, HeatmapMetrics, AtomicRadiiData } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { queryTwoToTwo, getAllElements, getNuclideBySymbol, getElementBySymbol, getAtomicRadii, calculateHeatmapMetrics } from '../services/queryService'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import PeriodicTable from '../components/PeriodicTable'
import ElementDetailsCard from '../components/ElementDetailsCard'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'
import { VirtualizedList } from '../components/VirtualizedList'

// Default values
const DEFAULT_ELEMENT1 = ['D']
const DEFAULT_ELEMENT2: string[] = []
const DEFAULT_OUTPUT_ELEMENT3: string[] = []
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
    // Support limit=0 for unlimited, otherwise default to DEFAULT_LIMIT
    return param !== null ? parseInt(param) : DEFAULT_LIMIT
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
  const [userTableHeight, setUserTableHeight] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef<number>(0)
  const resizeStartHeight = useRef<number>(0)

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
      return 'repeat(4, minmax(60px, 1fr)) repeat(10, minmax(60px, 0.9fr))'
    }
    return 'repeat(4, minmax(85px, 1fr)) minmax(60px, 1fr) minmax(60px, 1fr)'
  }, [showBosonFermion])

  const twoTwoEstimatedRowHeight = useMemo(() => (showBosonFermion ? 80 : 70), [showBosonFermion])
  const twoTwoCompactRowHeight = useMemo(() => (showBosonFermion ? 70 : 62), [showBosonFermion])

  const [highlightedNuclide, setHighlightedNuclide] = useState<string | null>(null)
  const [pinnedNuclide, setPinnedNuclide] = useState(false)
  const [selectedNuclideDetails, setSelectedNuclideDetails] = useState<Nuclide | null>(null)
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null)
  const [pinnedElement, setPinnedElement] = useState(false)
  const [selectedElementDetails, setSelectedElementDetails] = useState<Element | null>(null)
  const [selectedElementRadii, setSelectedElementRadii] = useState<AtomicRadiiData | null>(null)
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false)

  // Heatmap state
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('frequency')
  const [useAllResultsForHeatmap, setUseAllResultsForHeatmap] = useState(false)
  const [allResults, setAllResults] = useState<TwoToTwoReaction[]>([])

  // Filters visibility state (collapsed by default)
  const [showFilters, setShowFilters] = useState(false)

  // Calculate heatmap metrics from results (either limited or all)
  const heatmapMetrics = useMemo<HeatmapMetrics>(() => {
    const dataToUse = useAllResultsForHeatmap ? allResults : results
    if (dataToUse.length === 0) {
      return {
        frequency: new Map(),
        energy: new Map(),
        diversity: new Map(),
        inputOutputRatio: new Map()
      }
    }
    return calculateHeatmapMetrics(dataToUse, 'twotwo')
  }, [results, allResults, useAllResultsForHeatmap])

  // Helper function to check if a reaction contains a specific nuclide
  const reactionContainsNuclide = useCallback((reaction: TwoToTwoReaction, nuclide: string) => {
    const [element, mass] = nuclide.split('-')
    const A = parseInt(mass)
    return (
      (reaction.E1 === element && reaction.A1 === A) ||
      (reaction.E2 === element && reaction.A2 === A) ||
      (reaction.E3 === element && reaction.A3 === A) ||
      (reaction.E4 === element && reaction.A4 === A)
    )
  }, [])

  // Helper function to check if a reaction contains a specific element
  const reactionContainsElement = useCallback((reaction: TwoToTwoReaction, element: string) => {
    return reaction.E1 === element || reaction.E2 === element || reaction.E3 === element || reaction.E4 === element
  }, [])

  // Filter nuclides by pinned element if applicable
  const filteredNuclides = useMemo(() => {
    if (pinnedElement && highlightedElement) {
      return nuclides.filter(nuc => nuc.E === highlightedElement)
    }
    return nuclides
  }, [nuclides, pinnedElement, highlightedElement])

  // Filter reactions - mutually exclusive element/nuclide filtering
  const filteredResults = useMemo(() => {
    // If nuclide is pinned, filter by nuclide
    if (pinnedNuclide && highlightedNuclide) {
      return results.filter(reaction => reactionContainsNuclide(reaction, highlightedNuclide))
    }
    // If element is pinned, filter by element
    if (pinnedElement && highlightedElement) {
      return results.filter(reaction => reactionContainsElement(reaction, highlightedElement))
    }
    // No filtering
    return results
  }, [results, pinnedNuclide, highlightedNuclide, pinnedElement, highlightedElement, reactionContainsNuclide, reactionContainsElement])

  // Calculate base height for filtered results
  const filteredBaseListHeight = useMemo(() => {
    if (filteredResults.length === 0) {
      return 160
    }
    if (filteredResults.length <= SMALL_RESULT_THRESHOLD) {
      // For small result sets, use exact height without padding
      return filteredResults.length * twoTwoCompactRowHeight
    }
    const preferred = filteredResults.length * twoTwoEstimatedRowHeight
    const min = Math.max(twoTwoEstimatedRowHeight * Math.min(filteredResults.length, 4), 280)
    const max = 640
    return Math.min(max, Math.max(min, preferred))
  }, [filteredResults.length, twoTwoCompactRowHeight, twoTwoEstimatedRowHeight])

  // Calculate actual height for filtered results
  const filteredListHeight = useMemo(() => {
    // If user has manually resized, use their height (bounded by min/max)
    if (userTableHeight !== null) {
      const minHeight = 220
      const maxHeight = filteredBaseListHeight
      return Math.max(minHeight, Math.min(userTableHeight, maxHeight))
    }

    // For small result sets, don't enforce a minimum height or viewport constraint
    if (filteredResults.length <= SMALL_RESULT_THRESHOLD && filteredResults.length > 0) {
      return filteredBaseListHeight
    }
    const minHeight = 220
    const base = Math.max(minHeight, filteredBaseListHeight)
    if (twoTwoViewportHeight == null) {
      return base
    }
    return Math.max(minHeight, Math.min(base, twoTwoViewportHeight))
  }, [filteredBaseListHeight, twoTwoViewportHeight, filteredResults.length, userTableHeight])

  // Check if scrollbar is needed: list is shorter than content OR filtered content needs virtualization
  const twoTwoUsesScrollbar = useMemo(() => {
    return filteredListHeight < filteredBaseListHeight || filteredResults.length > SMALL_RESULT_THRESHOLD
  }, [filteredListHeight, filteredBaseListHeight, filteredResults.length])

  const twoTwoHeaderPadding = useMemo(() => {
    return !showBosonFermion && twoTwoUsesScrollbar ? SCROLLBAR_COMPENSATION : 0
  }, [showBosonFermion, twoTwoUsesScrollbar])

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

    // Only initialize if we have URL param and nothing is currently pinned
    // This prevents re-pinning on every results change
    if (pinE && !pinnedElement && resultElements.some(el => el.E === pinE)) {
      // Pinning element from URL - expand heatmap
      setHighlightedElement(pinE)
      setPinnedElement(true)
      setShowHeatmap(true) // Auto-expand heatmap when loading with pinned state
      setHasInitializedFromUrl(true)

      // Clear pinE/pinN params from URL now that we've used them
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('pinE')
      newParams.delete('pinN')
      setSearchParams(newParams, { replace: true })
    } else if (pinN && !pinnedNuclide && nuclides.some(nuc => `${nuc.E}-${nuc.A}` === pinN)) {
      // Pinning nuclide from URL - expand heatmap
      setHighlightedNuclide(pinN)
      setPinnedNuclide(true)
      setShowHeatmap(true) // Auto-expand heatmap when loading with pinned state
      setHasInitializedFromUrl(true)

      // Clear pinE/pinN params from URL now that we've used them
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('pinE')
      newParams.delete('pinN')
      setSearchParams(newParams, { replace: true })
    } else {
      // No URL params to initialize from
      setHasInitializedFromUrl(true)
    }
  }, [showResults, isInitialized, resultElements, nuclides, hasInitializedFromUrl, searchParams, pinnedElement, pinnedNuclide, setSearchParams])

  // Fetch element or nuclide details when pinned
  useEffect(() => {
    if (!db) {
      setSelectedElementDetails(null)
      setSelectedElementRadii(null)
      setSelectedNuclideDetails(null)
      return
    }

    // Fetch element details if pinned
    if (pinnedElement && highlightedElement) {
      const elementDetails = getElementBySymbol(db, highlightedElement)
      const radiiData = elementDetails ? getAtomicRadii(db, elementDetails.Z) : null
      setSelectedElementDetails(elementDetails)
      setSelectedElementRadii(radiiData)
      setSelectedNuclideDetails(null)
    }
    // Fetch nuclide details if pinned
    else if (pinnedNuclide && highlightedNuclide) {
      const [elementSymbol, massStr] = highlightedNuclide.split('-')
      const massNumber = parseInt(massStr)
      const nuclideDetails = getNuclideBySymbol(db, elementSymbol, massNumber)
      setSelectedNuclideDetails(nuclideDetails)
      // Also fetch element details for the parent element
      // Map D and T to H for element properties lookup
      const elementSymbolForLookup = (elementSymbol === 'D' || elementSymbol === 'T') ? 'H' : elementSymbol
      const elementDetails = getElementBySymbol(db, elementSymbolForLookup)
      const radiiData = elementDetails ? getAtomicRadii(db, elementDetails.Z) : null
      setSelectedElementDetails(elementDetails)
      setSelectedElementRadii(radiiData)
    } else {
      setSelectedElementDetails(null)
      setSelectedElementRadii(null)
      setSelectedNuclideDetails(null)
    }
  }, [db, pinnedElement, highlightedElement, pinnedNuclide, highlightedNuclide])

  // Update URL when filters change
  useEffect(() => {
    // Don't update URL until after initialization has processed pinE/pinN params
    if (!isInitialized || !hasInitializedFromUrl) return

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

    // Always set limit parameter explicitly (including default 100)
    params.set('limit', filter.limit?.toString() || DEFAULT_LIMIT.toString())

    // Note: pinE/pinN params are NOT preserved here
    // They are used only for initial page load, then immediately cleared by the initialization effect

    setSearchParams(params, { replace: true })
  }, [selectedElement1, selectedElement2, selectedOutputElement3, selectedOutputElement4, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit, isInitialized, hasInitializedFromUrl, searchParams])

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

      // Also fetch unlimited results for heatmap if toggle is enabled
      if (useAllResultsForHeatmap && result.totalCount > result.reactions.length) {
        const unlimitedQuery = { ...queryFilter, limit: undefined }
        const unlimitedResult = queryTwoToTwo(db, unlimitedQuery)
        setAllResults(unlimitedResult.reactions)
      } else if (!useAllResultsForHeatmap) {
        setAllResults([]) // Clear allResults if toggle is off
      }
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

  // Table resize handlers (supporting both mouse and touch)
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    resizeStartY.current = clientY
    resizeStartHeight.current = userTableHeight ?? filteredListHeight
  }, [filteredListHeight, userTableHeight])

  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return
    e.preventDefault() // Prevent scrolling during resize
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaY = clientY - resizeStartY.current
    const newHeight = resizeStartHeight.current + deltaY
    const minHeight = 220
    const maxHeight = filteredBaseListHeight
    setUserTableHeight(Math.max(minHeight, Math.min(newHeight, maxHeight)))
  }, [isResizing, filteredBaseListHeight])

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  const handleResizeReset = useCallback(() => {
    setUserTableHeight(null)
  }, [])

  // Reset user height when results change significantly
  useEffect(() => {
    setUserTableHeight(null)
  }, [results.length, showBosonFermion])

  // Add/remove mouse and touch event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      document.addEventListener('touchmove', handleResizeMove, { passive: false })
      document.addEventListener('touchend', handleResizeEnd)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
      document.body.style.touchAction = 'none'
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.removeEventListener('touchmove', handleResizeMove)
        document.removeEventListener('touchend', handleResizeEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.body.style.touchAction = ''
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

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

        {/* Input/Output Selectors (always visible) */}
        <div className="grid md:grid-cols-4 gap-6 mb-6">
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

          {/* Output Element 1 Selection (E3) */}
          <PeriodicTableSelector
            label="Output Element 1 (E3)"
            availableElements={elements}
            selectedElements={selectedOutputElement3}
            onSelectionChange={setSelectedOutputElement3}
            align="center"
          />

          {/* Output Element 2 Selection (E4) */}
          <PeriodicTableSelector
            label="Output Element 2 (E4)"
            availableElements={elements}
            selectedElements={selectedOutputElement4}
            onSelectionChange={setSelectedOutputElement4}
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
            <div className="grid md:grid-cols-3 gap-6 pb-4">
              {/* Energy Range */}
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

              {/* Neutrino Involvement */}
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
                  value={filter.limit ?? 100}
                  onChange={(e) => {
                    const val = e.target.value
                    setFilter({...filter, limit: val === '' ? 100 : parseInt(val)})
                  }}
                  min={0}
                  max={1000}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum 1000 rows</p>
              </div>
            </div>
          </div>
        </div>

        {/* SQL Preview with Reset Filters Button */}
        <div className="px-4 bg-gray-50 dark:bg-gray-800 rounded-md">
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
                  setSelectedOutputElement3(DEFAULT_OUTPUT_ELEMENT3)
                  setSelectedOutputElement4(DEFAULT_OUTPUT_ELEMENT4)
                }}
                className="btn btn-secondary px-4 py-1.5 text-sm whitespace-nowrap"
              >
                Reset Filters
              </button>
            </div>
          </div>
          <code className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 block font-mono break-all">
            {[
              'SELECT * FROM TwoToTwoAll',
              (selectedElement1.length > 0 || selectedElement2.length > 0 || selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0 || filter.minMeV !== undefined || filter.maxMeV !== undefined) && ' WHERE ',
              selectedElement1.length > 0 && `E1 IN (${selectedElement1.map(e => `'${e}'`).join(', ')})`,
              selectedElement1.length > 0 && (selectedElement2.length > 0 || selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0) && ' AND ',
              selectedElement2.length > 0 && `E2 IN (${selectedElement2.map(e => `'${e}'`).join(', ')})`,
              selectedElement2.length > 0 && (selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0) && ' AND ',
              selectedOutputElement3.length > 0 && `E3 IN (${selectedOutputElement3.map(e => `'${e}'`).join(', ')})`,
              selectedOutputElement3.length > 0 && selectedOutputElement4.length > 0 && ' AND ',
              selectedOutputElement4.length > 0 && `E4 IN (${selectedOutputElement4.map(e => `'${e}'`).join(', ')})`,
              (selectedElement1.length > 0 || selectedElement2.length > 0 || selectedOutputElement3.length > 0 || selectedOutputElement4.length > 0) && filter.minMeV !== undefined && ' AND ',
              filter.minMeV !== undefined && `MeV >= ${filter.minMeV}`,
              filter.maxMeV !== undefined && ` AND MeV <= ${filter.maxMeV}`,
              ` ORDER BY MeV ${filter.orderDirection?.toUpperCase()} LIMIT ${filter.limit || 100}`
            ].filter(Boolean).join('').replace(/\s+/g, ' ').trim()};
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
                  Click any element to filter the results table and nuclides list to show only reactions containing that element. Color intensity shows the selected metric value.
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
                {/* Metric Selector and Explanation */}
                <div className="flex flex-col md:flex-row gap-4 mb-4">
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

                  <div className="flex-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {heatmapMode === 'frequency' && (
                        <>
                          Number of times each element appears across {useAllResultsForHeatmap ? `all ${totalCount.toLocaleString()} matching` : results.length.toLocaleString()} reactions (as input or output).
                          Higher frequency = darker color.
                        </>
                      )}
                      {heatmapMode === 'energy' && (
                        <>
                          Total energy (MeV) from all reactions involving each element.
                          Higher total energy = darker color.
                        </>
                      )}
                      {heatmapMode === 'diversity' && (
                        <>
                          Number of unique isotopes of each element appearing in the results.
                          More isotopic variety = darker color.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Color Legend */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Element Role:</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Input</span>
                        <div className="flex-1 min-w-[60px] h-4 rounded" style={{
                          background: 'linear-gradient(to right, rgb(37, 99, 235), rgb(29, 131, 155), rgb(22, 163, 74))'
                        }}></div>
                        <span className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Output</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center md:text-left md:whitespace-nowrap">• Intensity shows metric value</span>
                  </div>
                </div>

                {/* Toggle for using all results + button to show all in table */}
                <div className={`mb-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-500 ease-in-out overflow-hidden ${
                  filter.limit && filter.limit > 0 && totalCount > filter.limit
                    ? 'max-h-40 opacity-100'
                    : 'max-h-0 opacity-0 mb-0'
                }`}>
                  {filter.limit && filter.limit > 0 && totalCount > filter.limit && (
                    <>
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
                            const allSelectedElements = [...selectedElement1, ...selectedElement2]
                            const queryFilter: QueryFilter = {
                              ...filter,
                              elements: allSelectedElements.length > 0 ? allSelectedElements : undefined,
                              element1List: selectedElement1.length > 0 ? selectedElement1 : undefined,
                              element2List: selectedElement2.length > 0 ? selectedElement2 : undefined,
                              outputElement3List: selectedOutputElement3.length > 0 ? selectedOutputElement3 : undefined,
                              outputElement4List: selectedOutputElement4.length > 0 ? selectedOutputElement4 : undefined,
                              limit: undefined
                            }
                            const unlimitedResult = queryTwoToTwo(db, queryFilter)
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
                    <button
                      onClick={() => {
                        // Set limit to 0 for unlimited AND enable heatmap toggle
                        setFilter({...filter, limit: 0})
                        setUseAllResultsForHeatmap(true)
                      }}
                      disabled={filter.limit === 0}
                      className="btn btn-secondary px-4 py-2 text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      title={filter.limit === 0 ? "Already showing all results" : "Remove limit and show all matching reactions in table"}
                    >
                      Show All in Table →
                    </button>
                    </>
                  )}
                </div>

                <PeriodicTable
                  availableElements={resultElements}
                  selectedElement={highlightedElement}
                  onElementClick={(symbol) => {
                    if (pinnedElement && highlightedElement === symbol) {
                      // Unpinning element
                      setPinnedElement(false)
                      setHighlightedElement(null)
                    } else {
                      // Pinning element - clear nuclide pinning (mutually exclusive)
                      setPinnedElement(true)
                      setHighlightedElement(symbol)
                      setPinnedNuclide(false)
                      setHighlightedNuclide(null)
                    }
                  }}
                  heatmapData={heatmapMetrics[heatmapMode]}
                  heatmapMode={heatmapMode}
                   showHeatmap={showHeatmap}
                   hideLegend={true}
                   hideCardContainer={true}
                   heatmapMetrics={heatmapMetrics}
                />
              </div>
            </div>
          </div>

          <div className="card p-6 pb-0 sm:pb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {pinnedNuclide && highlightedNuclide ? (
                    `Showing ${filteredResults.length.toLocaleString()} of ${results.length.toLocaleString()} reactions containing ${highlightedNuclide}`
                  ) : pinnedElement && highlightedElement ? (
                    `Showing ${filteredResults.length.toLocaleString()} of ${results.length.toLocaleString()} reactions containing ${highlightedElement}`
                  ) : results.length === totalCount ? (
                    `Showing all ${totalCount.toLocaleString()} matching reactions`
                  ) : (
                    `Showing ${results.length.toLocaleString()} of ${totalCount.toLocaleString()} matching reactions`
                  )}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Query executed in {executionTime.toFixed(2)}ms
                  {filter.limit && filter.limit > 0 && totalCount > filter.limit && (
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
              className="overflow-auto -mx-6 sm:mx-0"
              role="region"
              aria-label="Two-to-two reaction results"
            >
              <div className="w-fit min-w-full border border-gray-200 dark:border-gray-700 rounded-b-none rounded-t-none sm:rounded-t-lg" >
                <div
                  className="sticky top-0 z-[5]"
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
                    <div className="px-1 py-2 sm:px-3 text-center">Neutrino</div>
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
                    <div className="px-1 py-2 sm:px-3 text-center">Neutrino</div>
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
                ) : filteredResults.length <= SMALL_RESULT_THRESHOLD ? (
                  <div style={{ paddingRight: twoTwoHeaderPadding }}>
                    {filteredResults.map((reaction, index) => {
                        const activeNuclide = pinnedNuclide ? highlightedNuclide : highlightedNuclide
                        const nuclideMatch = !activeNuclide || reactionContainsNuclide(reaction, activeNuclide)
                        const isDesaturated = activeNuclide && !nuclideMatch

                        const isE1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                        const isE2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)
                        const isE3Radioactive = radioactiveNuclides.has(`${reaction.Z3}-${reaction.A3}`)
                        const isE4Radioactive = radioactiveNuclides.has(`${reaction.Z4}-${reaction.A4}`)

                        return (
                          <div
                            key={index}
                            className={`grid border-b border-gray-200 dark:border-gray-700 transition-colors duration-150 ${
                              isDesaturated ? 'opacity-30 grayscale' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                            }`}
                            style={{ gridTemplateColumns: twoTwoColumnTemplate }}
                          >
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-blue-50 dark:bg-blue-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z1}&A=${reaction.A1}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-blue-600 dark:text-blue-400"
                              >
                                {reaction.E1}-{reaction.A1}
                              </Link>
                              {isE1Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z1})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-blue-50 dark:bg-blue-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z2}&A=${reaction.A2}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-blue-600 dark:text-blue-400"
                              >
                                {reaction.E2}-{reaction.A2}
                              </Link>
                              {isE2Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z2})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-green-50 dark:bg-green-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z3}&A=${reaction.A3}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E3}-{reaction.A3}
                              </Link>
                              {isE3Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z3})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-green-50 dark:bg-green-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z4}&A=${reaction.A4}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E4}-{reaction.A4}
                              </Link>
                              {isE4Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z4})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                            <span className="font-semibold text-green-600 dark:text-green-300">{reaction.MeV.toFixed(2)}</span>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                      items={filteredResults}
                      estimatedRowHeight={twoTwoEstimatedRowHeight}
                      height={filteredListHeight}
                      overscanRowCount={6}
                      className="relative"
                      ariaLabel="Two-to-two reaction results"
                    >
                      {(reaction) => {
                        const activeNuclide = pinnedNuclide ? highlightedNuclide : highlightedNuclide
                        const nuclideMatch = !activeNuclide || reactionContainsNuclide(reaction, activeNuclide)
                        const isDesaturated = activeNuclide && !nuclideMatch

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
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-blue-50 dark:bg-blue-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z1}&A=${reaction.A1}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-blue-600 dark:text-blue-400"
                              >
                                {reaction.E1}-{reaction.A1}
                              </Link>
                              {isE1Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z1})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-blue-50 dark:bg-blue-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z2}&A=${reaction.A2}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-blue-600 dark:text-blue-400"
                              >
                                {reaction.E2}-{reaction.A2}
                              </Link>
                              {isE2Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z2})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-green-50 dark:bg-green-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z3}&A=${reaction.A3}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E3}-{reaction.A3}
                              </Link>
                              {isE3Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z3})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 bg-green-50 dark:bg-green-900/20 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link
                                to={`/element-data?Z=${reaction.Z4}&A=${reaction.A4}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E4}-{reaction.A4}
                              </Link>
                              {isE4Radioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z4})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                            <span className="font-semibold text-green-600 dark:text-green-300">{reaction.MeV.toFixed(2)}</span>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
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

            {/* Resize Handle - always visible, disabled for small result sets */}
            {filteredResults.length > 0 && (
                  <div
                    className={`-mx-6 sm:mx-0 flex items-center justify-center py-3 px-4 transition-all border-x border-b rounded-b-lg ${
                      filteredResults.length <= SMALL_RESULT_THRESHOLD
                        ? 'cursor-not-allowed opacity-40 bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                        : isResizing
                        ? 'cursor-ns-resize bg-blue-100 dark:bg-blue-900/50 border-blue-500 dark:border-blue-500'
                        : 'cursor-ns-resize bg-gray-100 dark:bg-gray-800/70 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                    style={{ touchAction: filteredResults.length > SMALL_RESULT_THRESHOLD ? 'none' : 'auto' }}
                    onMouseDown={filteredResults.length > SMALL_RESULT_THRESHOLD ? handleResizeStart : undefined}
                    onTouchStart={filteredResults.length > SMALL_RESULT_THRESHOLD ? handleResizeStart : undefined}
                    onDoubleClick={filteredResults.length > SMALL_RESULT_THRESHOLD ? handleResizeReset : undefined}
                    title={
                      filteredResults.length <= SMALL_RESULT_THRESHOLD
                        ? 'Resize handle (disabled for small result sets)'
                        : 'Drag to resize table height (double-click to reset)'
                    }
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className={`h-0.5 w-8 rounded-full transition-colors ${
                        filteredResults.length <= SMALL_RESULT_THRESHOLD
                          ? 'bg-gray-300 dark:bg-gray-600'
                          : isResizing ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-400 dark:bg-gray-500'
                      }`} />
                      <div className={`h-0.5 w-8 rounded-full transition-colors ${
                        filteredResults.length <= SMALL_RESULT_THRESHOLD
                          ? 'bg-gray-300 dark:bg-gray-600'
                          : isResizing ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-400 dark:bg-gray-500'
                      }`} />
                      <div className={`h-0.5 w-8 rounded-full transition-colors ${
                        filteredResults.length <= SMALL_RESULT_THRESHOLD
                          ? 'bg-gray-300 dark:bg-gray-600'
                          : isResizing ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-400 dark:bg-gray-500'
                      }`} />
                    </div>
                  </div>
            )}
          </div>

          {/* Nuclides Summary */}
          <div className="card p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {pinnedElement && highlightedElement ? (
                <>Nuclides of {highlightedElement} in Results ({filteredNuclides.length} of {nuclides.length})</>
              ) : (
                <>Nuclides Appearing in Results ({filteredNuclides.length})</>
              )}
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
                      // Unpinning nuclide - also unpin element if it's pinned
                      setPinnedNuclide(false)
                      setHighlightedNuclide(null)
                      if (pinnedElement) {
                        setPinnedElement(false)
                        setHighlightedElement(null)
                      }
                    } else {
                      // Pinning nuclide
                      setPinnedNuclide(true)
                      setHighlightedNuclide(nuclideId)
                      // Only clear element pinning if the nuclide is from a different element
                      if (pinnedElement && highlightedElement !== nuc.E) {
                        setPinnedElement(false)
                        setHighlightedElement(null)
                      }
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
          {selectedNuclideDetails ? (
            <>
              {selectedElementDetails && selectedElementRadii && (
                <ElementDetailsCard
                  element={selectedElementDetails}
                  atomicRadii={selectedElementRadii}
                  onClose={() => {
                    setPinnedNuclide(false)
                    setHighlightedNuclide(null)
                  }}
                />
              )}
              <NuclideDetailsCard
                nuclide={selectedNuclideDetails}
                onClose={() => {
                  setPinnedNuclide(false)
                  setHighlightedNuclide(null)
                }}
              />
            </>
          ) : selectedElementDetails && selectedElementRadii ? (
            <ElementDetailsCard
              element={selectedElementDetails}
              atomicRadii={selectedElementRadii}
              onClose={() => {
                setPinnedElement(false)
                setHighlightedElement(null)
              }}
            />
          ) : (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Details
              </h3>
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-sm">Click on an element or a nuclide above to see detailed properties</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
