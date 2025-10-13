import { useState, useEffect } from 'react'
import { Download, Info, Loader, Eye, EyeOff, Radiation } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import type { FissionReaction, QueryFilter, Element, Nuclide, AtomicRadiiData } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { queryFission, getAllElements, getElementBySymbol, getNuclideBySymbol, getAtomicRadii } from '../services/queryService'
import { normalizeElementSymbol } from '../utils/formatUtils'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import ElementDetailsCard from '../components/ElementDetailsCard'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'

// Default values
const DEFAULT_ELEMENT: string[] = ['Zr']
const DEFAULT_OUTPUT_ELEMENT1: string[] = []
const DEFAULT_OUTPUT_ELEMENT2: string[] = []
const DEFAULT_NEUTRINO_TYPES = ['none', 'left', 'right']
const DEFAULT_LIMIT = 100

export default function FissionQuery() {
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()
  const [availableElements, setAvailableElements] = useState<Element[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Helper to check if any URL parameters exist
  const hasAnyUrlParams = () => searchParams.toString().length > 0

  // Parse URL parameters or use defaults (only if no params exist)
  const getInitialElement = () => {
    const param = searchParams.get('e')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_ELEMENT
  }

  const getInitialOutputElement1 = () => {
    const param = searchParams.get('e1')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_OUTPUT_ELEMENT1
  }

  const getInitialOutputElement2 = () => {
    const param = searchParams.get('e2')
    if (param) return param.split(',')
    return hasAnyUrlParams() ? [] : DEFAULT_OUTPUT_ELEMENT2
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

  const [results, setResults] = useState<FissionReaction[]>([])
  const [showResults, setShowResults] = useState(false)
  const [selectedElement, setSelectedElement] = useState<string[]>(getInitialElement())
  const [selectedOutputElement1, setSelectedOutputElement1] = useState<string[]>(getInitialOutputElement1())
  const [selectedOutputElement2, setSelectedOutputElement2] = useState<string[]>(getInitialOutputElement2())
  const [elements, setElements] = useState<Element[]>([])
  const [nuclides, setNuclides] = useState<Nuclide[]>([])
  const [radioactiveNuclides, setRadioactiveNuclides] = useState<Set<string>>(new Set())
  const [queryTime, setQueryTime] = useState<number>(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isQuerying, setIsQuerying] = useState(false)
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

  // Load elements when database is ready
  useEffect(() => {
    if (db) {
      const allElements = getAllElements(db)
      setAvailableElements(allElements)
      setIsInitialized(true)
    }
  }, [db])

  // Save B/F toggle to localStorage
  useEffect(() => {
    localStorage.setItem('showBosonFermion', JSON.stringify(showBosonFermion))
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
    } else if (pinE && !pinnedElement && elements.some(el => el.E === pinE)) {
      // Only pin element if no nuclide is being pinned
      setHighlightedElement(pinE)
      setPinnedElement(true)
      setHasInitializedFromUrl(true)
    } else if (!pinE && !pinN) {
      // No URL params to initialize from
      setHasInitializedFromUrl(true)
    }
  }, [showResults, isInitialized, elements, nuclides, hasInitializedFromUrl, searchParams, pinnedElement, pinnedNuclide])

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

    if (selectedElement.length > 0) {
      params.set('e', selectedElement.join(','))
    }

    if (selectedOutputElement1.length > 0) {
      params.set('e1', selectedOutputElement1.join(','))
    }

    if (selectedOutputElement2.length > 0) {
      params.set('e2', selectedOutputElement2.join(','))
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
  }, [selectedElement, selectedOutputElement1, selectedOutputElement2, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit, pinnedElement, highlightedElement, pinnedNuclide, highlightedNuclide, isInitialized, showResults, searchParams])

  // Auto-execute query when filters change
  useEffect(() => {
    if (db) {
      handleQuery()
    }
  }, [db, selectedElement, selectedOutputElement1, selectedOutputElement2, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit])

  const handleQuery = () => {
    if (!db) return

    setIsQuerying(true)
    try {
      // Build filter with selected elements
      const queryFilter: QueryFilter = {
        ...filter,
        elements: selectedElement.length > 0 ? selectedElement : undefined,
        outputElement1List: selectedOutputElement1.length > 0 ? selectedOutputElement1 : undefined,
        outputElement2List: selectedOutputElement2.length > 0 ? selectedOutputElement2 : undefined
      }

      const result = queryFission(db, queryFilter)

      setResults(result.reactions)
      setElements(result.elements)
      setNuclides(result.nuclides)
      setRadioactiveNuclides(result.radioactiveNuclides)
      setQueryTime(result.executionTime)
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

    const headers = ['E', 'Z', 'A', 'E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'MeV', 'neutrino']
    const csvContent = [
      headers.join(','),
      ...results.map(r => [
        r.E, r.Z, r.A, r.E1, r.Z1, r.A1, r.E2, r.Z2, r.A2, r.MeV, r.neutrino
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fission_reactions_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Helper function to check if a reaction contains a specific nuclide
  const reactionContainsNuclide = (reaction: FissionReaction, nuclide: string) => {
    const [element, mass] = nuclide.split('-')
    const A = parseInt(mass)
    return (
      (reaction.E === element && reaction.A === A) ||
      (reaction.E1 === element && reaction.A1 === A) ||
      (reaction.E2 === element && reaction.A2 === A)
    )
  }

  // Helper function to check if a reaction contains a specific element
  const reactionContainsElement = (reaction: FissionReaction, element: string) => {
    return reaction.E === element || reaction.E1 === element || reaction.E2 === element
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Fission Reactions</h1>
        <p className="text-gray-600 dark:text-gray-400">Query exothermic fission reactions where heavy nuclei split into lighter products</p>
      </div>

      {/* Query Builder */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Query Parameters</h2>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Input Element Selection (E) */}
          <PeriodicTableSelector
            label="Input Element (E)"
            availableElements={availableElements}
            selectedElements={selectedElement}
            onSelectionChange={setSelectedElement}
          />

          {/* Output Element 1 Selection (E1) */}
          <PeriodicTableSelector
            label="Output Element 1 (E1)"
            availableElements={availableElements}
            selectedElements={selectedOutputElement1}
            onSelectionChange={setSelectedOutputElement1}
            align="center"
          />

          {/* Output Element 2 Selection (E2) */}
          <PeriodicTableSelector
            label="Output Element 2 (E2)"
            availableElements={availableElements}
            selectedElements={selectedOutputElement2}
            onSelectionChange={setSelectedOutputElement2}
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
              setSelectedElement(DEFAULT_ELEMENT)
              setSelectedOutputElement1(DEFAULT_OUTPUT_ELEMENT1)
              setSelectedOutputElement2(DEFAULT_OUTPUT_ELEMENT2)
            }}
            className="btn btn-secondary px-6 py-2"
          >
            Reset Filters
          </button>
          {isQuerying && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Loader className="w-4 h-4 animate-spin" />
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
            SELECT * FROM FissionAll
            {(selectedElement.length > 0 || selectedOutputElement1.length > 0 || selectedOutputElement2.length > 0 || filter.minMeV !== undefined || filter.maxMeV !== undefined) && ' WHERE '}
            {selectedElement.length > 0 && `E IN (${selectedElement.map(e => `'${e}'`).join(', ')})`}
            {selectedElement.length > 0 && (selectedOutputElement1.length > 0 || selectedOutputElement2.length > 0) && ' AND '}
            {selectedOutputElement1.length > 0 && `E1 IN (${selectedOutputElement1.map(e => `'${e}'`).join(', ')})`}
            {selectedOutputElement1.length > 0 && selectedOutputElement2.length > 0 && ' AND '}
            {selectedOutputElement2.length > 0 && `E2 IN (${selectedOutputElement2.map(e => `'${e}'`).join(', ')})`}
            {(selectedElement.length > 0 || selectedOutputElement1.length > 0 || selectedOutputElement2.length > 0) && filter.minMeV !== undefined && ' AND '}
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Query executed in {queryTime.toFixed(2)}ms
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

            <div className="table-container -mx-6 sm:mx-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th rowSpan={2} className="bg-blue-50 dark:bg-blue-900/30">Input</th>
                    <th colSpan={2} className="bg-green-50 dark:bg-green-900/30">Outputs</th>
                    <th rowSpan={2}>Energy<br/>(MeV)</th>
                    <th rowSpan={2}>Neutrino</th>
                    {showBosonFermion && (
                      <>
                        <th colSpan={2} className="bg-purple-50 dark:bg-purple-900/30">Input Type</th>
                        <th colSpan={2} className="bg-amber-50 dark:bg-amber-900/30">Output 1 Type</th>
                        <th colSpan={2} className="bg-amber-50 dark:bg-amber-900/30">Output 2 Type</th>
                      </>
                    )}
                  </tr>
                  <tr>
                    <th className="bg-green-50 dark:bg-green-900/30">Output 1</th>
                    <th className="bg-green-50 dark:bg-green-900/30">Output 2</th>
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
                    const isInputRadioactive = radioactiveNuclides.has(`${reaction.Z}-${reaction.A}`)
                    const isOutput1Radioactive = radioactiveNuclides.has(`${reaction.Z1}-${reaction.A1}`)
                    const isOutput2Radioactive = radioactiveNuclides.has(`${reaction.Z2}-${reaction.A2}`)

                    return (
                    <tr key={idx} className={isDesaturated ? 'opacity-30 grayscale' : 'transition-all duration-200'}>
                      <td className="bg-blue-50 dark:bg-blue-900/30 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/element-data?Z=${reaction.Z}&A=${reaction.A}`}
                            className="font-semibold text-base hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {reaction.E}-{reaction.A}
                          </Link>
                          {isInputRadioactive && (
                            <span title="Radioactive">
                              <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z})</div>
                      </td>
                      <td className="bg-green-50 dark:bg-green-900/30 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/element-data?Z=${reaction.Z1}&A=${reaction.A1}`}
                            className="font-semibold text-base hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {reaction.E1}-{reaction.A1}
                          </Link>
                          {isOutput1Radioactive && (
                            <span title="Radioactive">
                              <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z1})</div>
                      </td>
                      <td className="bg-green-50 dark:bg-green-900/30 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/element-data?Z=${reaction.Z2}&A=${reaction.A2}`}
                            className="font-semibold text-base hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {reaction.E2}-{reaction.A2}
                          </Link>
                          {isOutput2Radioactive && (
                            <span title="Radioactive">
                              <Radiation className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z2})</div>
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
                          {/* Input Type */}
                          <td className="bg-purple-50 dark:bg-purple-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.nBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.nBorF === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-purple-50 dark:bg-purple-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.aBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.aBorF === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          {/* Output 1 Type */}
                          <td className="bg-amber-50 dark:bg-amber-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.nBorF1 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.nBorF1 === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-amber-50 dark:bg-amber-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.aBorF1 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.aBorF1 === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          {/* Output 2 Type */}
                          <td className="bg-amber-50 dark:bg-amber-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.nBorF2 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.nBorF2 === 'b' ? 'Boson' : 'Fermion'}
                            </span>
                          </td>
                          <td className="bg-amber-50 dark:bg-amber-900/30">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              reaction.aBorF2 === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            }`}>
                              {reaction.aBorF2 === 'b' ? 'Boson' : 'Fermion'}
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
                Nuclides Appearing in Results ({nuclides.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {nuclides.map((nuc, idx) => {
                  const nuclideId = `${nuc.E}-${nuc.A}`
                  const isActive = highlightedNuclide === nuclideId
                  const isPinned = pinnedNuclide && highlightedNuclide === nuclideId
                  const isDesaturated = highlightedNuclide && highlightedNuclide !== nuclideId
                  const nuclideIsRadioactive = radioactiveNuclides.has(`${nuc.Z}-${nuc.A}`)

                  return (
                  <div
                    key={idx}
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
                Elements Appearing in Results ({elements.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {elements.map((el) => {
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
