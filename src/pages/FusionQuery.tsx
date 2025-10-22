import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Download, Info, Loader2, Eye, EyeOff, Radiation, ChevronDown } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import type { FusionReaction, QueryFilter, Nuclide, Element, HeatmapMode, HeatmapMetrics, AtomicRadiiData } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { useQueryState } from '../contexts/QueryStateContext'
import { queryFusion, getAllElements, getNuclideBySymbol, getElementBySymbol, getAtomicRadii, getFusionSqlPreview, calculateHeatmapMetrics } from '../services/queryService'
import ElementDetailsCard from '../components/ElementDetailsCard'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import PeriodicTable from '../components/PeriodicTable'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'
import { VirtualizedList } from '../components/VirtualizedList'
import LimitSelector from '../components/LimitSelector'

// Default values
const DEFAULT_ELEMENT1: string[] = []
const DEFAULT_ELEMENT2: string[] = []
const DEFAULT_OUTPUT_ELEMENT: string[] = []
const DEFAULT_NEUTRINO_TYPES = ['none', 'left', 'right']
const DEFAULT_LIMIT = 500
const SMALL_RESULT_THRESHOLD = 12
const SCROLLBAR_COMPENSATION = 16

export default function FusionQuery() {
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getFusionState, updateFusionState } = useQueryState()
  const [elements, setElements] = useState<Element[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Helper to check if any URL parameters exist
  // Default element selections based on URL params

  const getInitialElement2 = () => {
    const param = searchParams.get('e2')
    if (param) return param.split(',')
    return searchParams.toString().length > 0 ? [] : DEFAULT_ELEMENT2
  }

  const getInitialOutputElement = () => {
    const param = searchParams.get('e')
    if (param) return param.split(',')
    return searchParams.toString().length > 0 ? [] : DEFAULT_OUTPUT_ELEMENT
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

  const getInitialElement1 = () => {
    const param = searchParams.get('e1')
    if (param) return param.split(',')
    return searchParams.toString().length > 0 ? [] : DEFAULT_ELEMENT1
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
  const [userTableHeight, setUserTableHeight] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const resizeStartY = useRef<number>(0)
  const resizeStartHeight = useRef<number>(0)

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
      return 'minmax(85px, 1fr) minmax(85px, 1fr) minmax(85px, 1fr) minmax(100px, 1fr) minmax(100px, 1fr) repeat(6, minmax(70px, 0.9fr))'
    }
    return 'minmax(85px, 1fr) minmax(85px, 1fr) minmax(85px, 1fr) minmax(60px, 0.8fr) minmax(60px, 0.8fr)'
  }, [showBosonFermion])

  const fusionEstimatedRowHeight = useMemo(() => (showBosonFermion ? 70 : 60), [showBosonFermion])
  const fusionCompactRowHeight = useMemo(() => (showBosonFermion ? 60 : 52), [showBosonFermion])

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
  const [allResults, setAllResults] = useState<FusionReaction[]>([])

  // Filters visibility state (collapsed by default)
  const [showFilters, setShowFilters] = useState(false)

  // Add a flag to track if we've restored from localStorage
  const [hasRestoredFromContext, setHasRestoredFromContext] = useState(false)

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
        diversity: new Map(),
        inputOutputRatio: new Map()
      }
    }
    return calculateHeatmapMetrics(dataToUse, 'fusion')
  }, [results, allResults, useAllResultsForHeatmap])

  // Helper function to check if a reaction contains a specific nuclide
  const reactionContainsNuclide = useCallback((reaction: FusionReaction, nuclide: string) => {
    const [element, mass] = nuclide.split('-')
    const A = parseInt(mass)
    return (
      (reaction.E1 === element && reaction.A1 === A) ||
      (reaction.E2 === element && reaction.A2 === A) ||
      (reaction.E === element && reaction.A === A)
    )
  }, [])

  // Helper function to check if a reaction contains a specific element
  const reactionContainsElement = useCallback((reaction: FusionReaction, element: string) => {
    return reaction.E1 === element || reaction.E2 === element || reaction.E === element
  }, [])

  // Filter nuclides to only show those from the pinned element
  const filteredNuclides = useMemo(() => {
    if (pinnedElement && highlightedElement) {
      return nuclides.filter(nuc => nuc.E === highlightedElement)
    }
    return nuclides
  }, [nuclides, pinnedElement, highlightedElement])

  // Filter reactions to only show those containing the pinned nuclide or element (mutually exclusive)
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
      // For small result sets, skip virtualization - no fixed height needed
      return filteredResults.length * fusionCompactRowHeight
    }
    const preferred = filteredResults.length * fusionEstimatedRowHeight
    const min = Math.max(fusionEstimatedRowHeight * Math.min(filteredResults.length, 4), 260)
    const max = 640
    return Math.min(max, Math.max(min, preferred))
  }, [fusionCompactRowHeight, fusionEstimatedRowHeight, filteredResults.length])

  // Calculate actual height for filtered results
  const filteredListHeight = useMemo(() => {
    // If user has manually resized, use their height (bounded by min/max)
    if (userTableHeight !== null) {
      const minHeight = 220
      const maxHeight = filteredBaseListHeight
      return Math.max(minHeight, Math.min(userTableHeight, maxHeight))
    }

    // For small result sets, don't enforce a minimum height
    if (filteredResults.length <= SMALL_RESULT_THRESHOLD && filteredResults.length > 0) {
      return filteredBaseListHeight
    }
    const minHeight = 220
    const base = Math.max(minHeight, filteredBaseListHeight)
    if (fusionViewportHeight == null) {
      return base
    }
    return Math.max(minHeight, Math.min(base, fusionViewportHeight))
  }, [filteredBaseListHeight, fusionViewportHeight, filteredResults.length, userTableHeight])

  // Check if scrollbar is needed: list is shorter than content OR filtered content needs virtualization
  const fusionUsesScrollbar = useMemo(() => {
    return filteredListHeight < filteredBaseListHeight || filteredResults.length > SMALL_RESULT_THRESHOLD
  }, [filteredListHeight, filteredBaseListHeight, filteredResults.length])

  const fusionHeaderPadding = useMemo(() => {
    return !showBosonFermion && fusionUsesScrollbar ? SCROLLBAR_COMPENSATION : 0
  }, [showBosonFermion, fusionUsesScrollbar])

  // Load elements when database is ready
  useEffect(() => {
    if (db) {
      const allElements = getAllElements(db)
      setElements(allElements)
      setIsInitialized(true)

      // Restore state from context if no URL params exist
      if (searchParams.toString().length === 0 && !hasRestoredFromContext) {
        const savedState = getFusionState()
        if (savedState) {
          // Restore selections
          if (savedState.selectedElement1) setSelectedElement1(savedState.selectedElement1)
          if (savedState.selectedElement2) setSelectedElement2(savedState.selectedElement2)
          if (savedState.selectedOutputElement) setSelectedOutputElement(savedState.selectedOutputElement)

          // Restore filter
          if (savedState.filter) {
            setFilter(prev => ({
              ...prev,
              ...savedState.filter,
              minMeV: savedState.minMeV ?? prev.minMeV,
              maxMeV: savedState.maxMeV ?? prev.maxMeV,
              neutrinoTypes: savedState.neutrino ? [savedState.neutrino] : prev.neutrinoTypes,
              limit: savedState.limit ?? prev.limit
            }))
          }

          // Restore visualization state
          if (savedState.visualization) {
            if (savedState.visualization.showHeatmap !== undefined) setShowHeatmap(savedState.visualization.showHeatmap)
            if (savedState.visualization.heatmapMode) setHeatmapMode(savedState.visualization.heatmapMode)
            if (savedState.visualization.userTableHeight) setUserTableHeight(savedState.visualization.userTableHeight)
          }

          // Restore UI preferences
          if (savedState.showBosonFermion !== undefined) setShowBosonFermion(savedState.showBosonFermion)
        }
        setHasRestoredFromContext(true)
      }
    }
  }, [db, searchParams, hasRestoredFromContext])

  // Initialize pinned element/nuclide state from URL params (after results are loaded)
  // This effect should ONLY run once when results first load, not on every URL change
  useEffect(() => {
    if (!showResults || !isInitialized || hasInitializedFromUrl) return

    const pinE = searchParams.get('pinE')
    const pinN = searchParams.get('pinN')

    // Only initialize if we have URL param and nothing is currently pinned
    // Element and nuclide pinning are mutually exclusive - prioritize pinN
    if (pinN && !pinnedNuclide && !pinnedElement && nuclides.some(nuc => `${nuc.E}-${nuc.A}` === pinN)) {
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
    } else if (pinE && !pinnedNuclide && !pinnedElement && resultElements.some(elem => elem.E === pinE)) {
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
    } else {
      // No URL params to initialize from
      setHasInitializedFromUrl(true)
    }
  }, [showResults, isInitialized, nuclides, resultElements, hasInitializedFromUrl, searchParams, pinnedNuclide, pinnedElement, setSearchParams])

  // Save B/F toggle to localStorage
  useEffect(() => {
    localStorage.setItem('showBosonFermion', JSON.stringify(showBosonFermion))
  }, [showBosonFermion])

  // Save state changes to QueryStateContext
  useEffect(() => {
    // Don't save if we're still initializing
    if (!isInitialized || !hasRestoredFromContext) return

    // Save current state to context
    updateFusionState({
      filter,
      selectedElement1,
      selectedElement2,
      selectedOutputElement,
      minMeV: filter.minMeV,
      maxMeV: filter.maxMeV,
      neutrino: filter.neutrinoTypes?.[0] as any,
      limit: filter.limit,
      showBosonFermion,
      visualization: {
        pinnedNuclide: pinnedNuclide && highlightedNuclide ?
          (() => {
            const [E, A] = highlightedNuclide.split('-')
            return { Z: 0, A: parseInt(A), E }
          })() : null,
        pinnedElement: pinnedElement && highlightedElement ?
          { Z: 0, E: highlightedElement } : null,
        highlightedNuclide: !pinnedNuclide && highlightedNuclide ?
          (() => {
            const [E, A] = highlightedNuclide.split('-')
            return { Z: 0, A: parseInt(A), E }
          })() : null,
        highlightedElement: !pinnedElement && highlightedElement ?
          { Z: 0, E: highlightedElement } : null,
        showHeatmap,
        heatmapMode,
        userTableHeight: userTableHeight ?? undefined
      }
    })
  }, [
    isInitialized,
    filter,
    selectedElement1,
    selectedElement2,
    selectedOutputElement,
    showBosonFermion,
    pinnedNuclide,
    pinnedElement,
    highlightedNuclide,
    highlightedElement,
    showHeatmap,
    heatmapMode,
    userTableHeight,
    updateFusionState
  ])

  // Fetch nuclide or element details when pinned
  useEffect(() => {
    if (!db) {
      setSelectedNuclideDetails(null)
      setSelectedElementDetails(null)
      setSelectedElementRadii(null)
      return
    }

    // Fetch nuclide details if pinned
    if (pinnedNuclide && highlightedNuclide) {
      const [elementSymbol, massStr] = highlightedNuclide.split('-')
      const massNumber = parseInt(massStr)
      const nuclideDetails = getNuclideBySymbol(db, elementSymbol, massNumber)
      setSelectedNuclideDetails(nuclideDetails)
      // Also fetch element details for the parent element
      // Map D and T to H for element properties lookup
      const elementSymbolForLookup = (elementSymbol === 'D' || elementSymbol === 'T') ? 'H' : elementSymbol
      const elementDetails = getElementBySymbol(db, elementSymbolForLookup)
      const radii = elementDetails ? getAtomicRadii(db, elementDetails.Z) : null
      setSelectedElementDetails(elementDetails)
      setSelectedElementRadii(radii)
    } else if (pinnedElement && highlightedElement) {
      // Fetch element details if pinned
      const elementDetails = getElementBySymbol(db, highlightedElement)
      const radii = elementDetails ? getAtomicRadii(db, elementDetails.Z) : null
      setSelectedElementDetails(elementDetails)
      setSelectedElementRadii(radii)
      // Clear nuclide details
      setSelectedNuclideDetails(null)
    } else {
      setSelectedNuclideDetails(null)
      setSelectedElementDetails(null)
      setSelectedElementRadii(null)
    }
  }, [db, pinnedNuclide, highlightedNuclide, pinnedElement, highlightedElement])

  // Update URL when filters or pinned state changes
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

    // Always set limit parameter explicitly (including default 100)
    params.set('limit', filter.limit?.toString() || DEFAULT_LIMIT.toString())

    // Note: pinE/pinN params are NOT preserved here
    // They are used only for initial page load, then immediately cleared by the initialization effect

    setSearchParams(params, { replace: true })
  }, [selectedElement1, selectedElement2, selectedOutputElement, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit, isInitialized, hasInitializedFromUrl, searchParams])

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
      console.log("result: ", result)

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
            testId="fusion-input-element-1-selector"
          />

          {/* Input Element 2 Selection (E2) */}
          <PeriodicTableSelector
            label="Input Element 2 (E2)"
            availableElements={elements}
            selectedElements={selectedElement2}
            onSelectionChange={setSelectedElement2}
            align="center"
            testId="fusion-input-element-2-selector"
          />

          {/* Output Element Selection (E) */}
          <PeriodicTableSelector
            label="Output Element (E)"
            availableElements={elements}
            selectedElements={selectedOutputElement}
            onSelectionChange={setSelectedOutputElement}
            align="right"
            testId="fusion-output-element-selector"
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

          <div className={`transition-all duration-300 ease-in-out overflow-visible ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="grid md:grid-cols-3 gap-6 overflow-visible">
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
              <div className="overflow-visible">
                <LimitSelector
                  value={filter.limit}
                  onChange={(limit) => setFilter({...filter, limit})}
                />
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
                  Element Heatmap
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
                        <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Input</span>
                        <div className="flex-1 min-w-[60px] h-4 rounded" style={{
                          background: 'linear-gradient(to right, rgb(37, 99, 235), rgb(29, 131, 155), rgb(22, 163, 74))'
                        }}></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Output</span>
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
                   heatmapMetrics={heatmapMetrics}
                   hideLegend={true}
                   hideCardContainer={true}
                />
              </div>
            </div>
          </div>

          {/* Results Table */}
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

            <div
              ref={tableContainerRef}
              className="overflow-auto -mx-6 sm:mx-0"
              role="region"
              aria-label="Fusion reaction results"
            >
              <div className="w-fit min-w-full border border-gray-200 dark:border-gray-700 rounded-b-none rounded-t-none sm:rounded-t-lg" >
                <div
                  className="sticky top-0 z-[5]"
                  style={{ paddingRight: fusionHeaderPadding }}
                >
                  <div
                    className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                    style={{ gridTemplateColumns: fusionColumnTemplate }}
                  >
                    <div className="px-3 py-2 text-center bg-blue-50 dark:bg-blue-900/30 col-span-2">
                      Inputs
                    </div>
                    <div className="px-3 py-2 text-center bg-green-50 dark:bg-green-900/30">
                      Output
                    </div>
                    <div className="px-1 py-2 sm:px-3 text-center">Energy (MeV)</div>
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
                          Output Type
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    className="grid border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 text-xs font-medium uppercase text-gray-500 dark:text-gray-400"
                    style={{ gridTemplateColumns: fusionColumnTemplate }}
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

                {filteredResults.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {results.length === 0 ? 'Run a query to view fusion reactions.' : (
                      // Enhanced empty state for pinned elements in limited results
                      useAllResultsForHeatmap && pinnedElement && highlightedElement && (filter.limit ?? 0) > 0 && totalCount > (filter.limit ?? 0) ? (
                        <div className="space-y-3">
                          <div>
                            Element <span className="font-medium">{selectedElementDetails?.EName || highlightedElement}</span> exists in the full dataset but not in the limited results. (may be slow)
                          </div>
                          <button
                            onClick={() => {
                              // Set limit to 0 for unlimited AND enable heatmap toggle
                              setFilter({...filter, limit: 0})
                              setUseAllResultsForHeatmap(true)
                            }}
                            className="btn btn-secondary px-4 py-2 text-sm whitespace-nowrap"
                            title="Remove limit and show all matching reactions in table"
                          >
                            Show All in Table →
                          </button>
                        </div>
                      ) : (
                        'No reactions match the selected filter.'
                      )
                    )}
                  </div>
                ) : filteredResults.length <= SMALL_RESULT_THRESHOLD ? (
                  <div style={{ paddingRight: fusionHeaderPadding }}>
                    {filteredResults.map((reaction, index) => {
                      const isE1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                      const isE2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)
                      const isOutputRadioactive = radioactiveNuclides.has(`${reaction.Z}-${reaction.A}`)

                      return (
                        <div
                          key={index}
                          className="grid border-b border-gray-200 dark:border-gray-700 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                          style={{ gridTemplateColumns: fusionColumnTemplate }}
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
                                to={`/element-data?Z=${reaction.Z}&A=${reaction.A}`}
                                className="font-semibold text-sm sm:text-base hover:underline text-green-600 dark:text-green-400"
                              >
                                {reaction.E}-{reaction.A}
                              </Link>
                              {isOutputRadioactive && (
                                <span title="Radioactive">
                                  <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z})</div>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                            <span className="font-semibold text-green-600 dark:text-green-300">{reaction.MeV.toFixed(2)}</span>
                          </div>
                          <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                            <span
                              className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                    reaction.nBorF === 'b'
                                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                  }`}
                                >
                                  {reaction.nBorF === 'b' ? 'Boson' : 'Fermion'}
                                </span>
                              </div>
                              <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                                <span
                                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                    })}
                  </div>
                ) : (
                  <div style={{ paddingRight: fusionHeaderPadding }}>
                    <VirtualizedList
                      items={filteredResults}
                      estimatedRowHeight={fusionEstimatedRowHeight}
                      height={filteredListHeight}
                      overscanRowCount={4}
                      className="fusion-results-list"
                      ariaLabel="Fusion reactions list"
                    >
                      {(reaction) => {
                        const isE1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                        const isE2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)
                        const isOutputRadioactive = radioactiveNuclides.has(`${reaction.Z}-${reaction.A}`)

                        return (
                          <div
                            className="grid border-b border-gray-200 dark:border-gray-700 transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                            style={{ gridTemplateColumns: fusionColumnTemplate }}
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
                                  to={`/element-data?Z=${reaction.Z}&A=${reaction.A}`}
                                  className="font-semibold text-sm sm:text-base hover:underline text-green-600 dark:text-green-400"
                                >
                                  {reaction.E}-{reaction.A}
                                </Link>
                                {isOutputRadioactive && (
                                  <span title="Radioactive">
                                    <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z})</div>
                            </div>
                            <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                              <span className="font-semibold text-green-600 dark:text-green-300">{reaction.MeV.toFixed(2)}</span>
                            </div>
                            <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                              <span
                                className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
                                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                      reaction.nBorF === 'b'
                                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                        : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                    }`}
                                  >
                                    {reaction.nBorF === 'b' ? 'Boson' : 'Fermion'}
                                  </span>
                                </div>
                                <div className="px-1 py-1.5 sm:px-3 sm:py-3 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
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
              {selectedElementDetails && (
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
          ) : selectedElementDetails ? (
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
