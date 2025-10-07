import { useState, useEffect } from 'react'
import { Search, Download, Info, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { FusionReaction, QueryFilter, Nuclide, Element } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { queryFusion, getAllElements } from '../services/queryService'
import PeriodicTableSelector from '../components/PeriodicTableSelector'

// Default values
const DEFAULT_ELEMENT1 = ['H']
const DEFAULT_ELEMENT2 = ['C', 'O']
const DEFAULT_OUTPUT_ELEMENT: string[] = []
const DEFAULT_NEUTRINO_TYPES = ['none', 'left', 'right']
const DEFAULT_LIMIT = 100

export default function FusionQuery() {
  const { db, isLoading: dbLoading, error: dbError } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()
  const [elements, setElements] = useState<Element[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Parse URL parameters or use defaults
  const getInitialElement1 = () => {
    const param = searchParams.get('e1')
    return param ? param.split(',') : DEFAULT_ELEMENT1
  }

  const getInitialElement2 = () => {
    const param = searchParams.get('e2')
    return param ? param.split(',') : DEFAULT_ELEMENT2
  }

  const getInitialOutputElement = () => {
    const param = searchParams.get('e')
    return param ? param.split(',') : DEFAULT_OUTPUT_ELEMENT
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

  // Load elements when database is ready
  useEffect(() => {
    if (db) {
      const allElements = getAllElements(db)
      setElements(allElements)
      setIsInitialized(true)
    }
  }, [db])

  // Save B/F toggle to localStorage
  useEffect(() => {
    localStorage.setItem('showBosonFermion', JSON.stringify(showBosonFermion))
  }, [showBosonFermion])

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

    setSearchParams(params, { replace: true })
  }, [selectedElement1, selectedElement2, selectedOutputElement, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit, isInitialized])

  // Auto-execute query when filters change
  useEffect(() => {
    if (db) {
      handleQuery()
    }
  }, [db, selectedElement1, selectedElement2, selectedOutputElement, filter.minMeV, filter.maxMeV, filter.neutrinoTypes, filter.limit])

  const handleQuery = () => {
    if (!db) return

    setIsQuerying(true)

    try {
      // Build filter with selected elements
      const queryFilter: QueryFilter = {
        ...filter,
        element1List: selectedElement1.length > 0 ? selectedElement1 : undefined,
        element2List: selectedElement2.length > 0 ? selectedElement2 : undefined,
        outputElementList: selectedOutputElement.length > 0 ? selectedOutputElement : undefined
      }

      const result = queryFusion(db, queryFilter)

      setResults(result.reactions)
      setNuclides(result.nuclides)
      setResultElements(result.elements)
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

  if (dbLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading database...</p>
        </div>
      </div>
    )
  }

  if (dbError) {
    return (
      <div className="card p-6 bg-red-50 dark:bg-red-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-1">Database Error</h3>
            <p className="text-red-700 dark:text-red-300">{dbError.message}</p>
          </div>
        </div>
      </div>
    )
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
            SELECT * FROM FusionAll
            {(selectedElement1.length > 0 || selectedElement2.length > 0 || selectedOutputElement.length > 0 || filter.minMeV !== undefined || filter.maxMeV !== undefined) && ' WHERE '}
            {selectedElement1.length > 0 && `E1 IN (${selectedElement1.map(e => `'${e}'`).join(', ')})`}
            {selectedElement1.length > 0 && (selectedElement2.length > 0 || selectedOutputElement.length > 0) && ' AND '}
            {selectedElement2.length > 0 && `E2 IN (${selectedElement2.map(e => `'${e}'`).join(', ')})`}
            {selectedElement2.length > 0 && selectedOutputElement.length > 0 && ' AND '}
            {selectedOutputElement.length > 0 && `E IN (${selectedOutputElement.map(e => `'${e}'`).join(', ')})`}
            {(selectedElement1.length > 0 || selectedElement2.length > 0 || selectedOutputElement.length > 0) && filter.minMeV !== undefined && ' AND '}
            {filter.minMeV !== undefined && `MeV >= ${filter.minMeV}`}
            {filter.maxMeV !== undefined && ` AND MeV <= ${filter.maxMeV}`}
            {` ORDER BY MeV ${filter.orderDirection?.toUpperCase()} LIMIT ${filter.limit || 100}`}
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

            <div className="table-container">
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
                  {results.map((reaction, idx) => (
                    <tr key={idx}>
                      <td className="bg-blue-50 dark:bg-blue-900/30 text-center">
                        <div className="font-semibold text-base">{reaction.E1}-{reaction.A1}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z1})</div>
                      </td>
                      <td className="bg-blue-50 dark:bg-blue-900/30 text-center">
                        <div className="font-semibold text-base">{reaction.E2}-{reaction.A2}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">(Z={reaction.Z2})</div>
                      </td>
                      <td className="bg-green-50 dark:bg-green-900/30 text-center">
                        <div className="font-semibold text-base">{reaction.E}-{reaction.A}</div>
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
                  ))}
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
              {nuclides.map(nuc => (
                <div key={nuc.id} className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{nuc.E}-{nuc.A}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Z={nuc.Z}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Elements Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Elements Appearing in Results ({resultElements.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {resultElements.map(el => (
                <div key={el.Z} className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
                  <div className="font-bold text-lg text-blue-900 dark:text-blue-200">{el.E}</div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">{el.EName}</div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">Z={el.Z}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
