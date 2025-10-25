import { useState } from 'react'
import { Play, BookOpen, Download, Loader, AlertCircle } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'

export default function AllTables() {
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM FusionAll WHERE MeV > 10 ORDER BY MeV DESC LIMIT 100')
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [queryTime, setQueryTime] = useState<number>(0)
  const [isExecuting, setIsExecuting] = useState(false)

  const exampleQueries = [
    'SELECT * FROM NuclidesPlus ORDER BY Z, A',
    'SELECT * FROM ElementsPlus WHERE Melting > 1000',
    'SELECT * FROM FusionAll WHERE E1 = "H" AND MeV > 20 LIMIT 50',
    'SELECT * FROM FissionAll WHERE E = "Pb" ORDER BY MeV DESC LIMIT 50',
    'SELECT * FROM TwoToTwoAll WHERE E1 IN ("H","D") AND E2 = "Ni" ORDER BY MeV DESC LIMIT 50',
    'SELECT COUNT(*) as TotalReactions FROM FusionAll',
    'SELECT E, COUNT(*) as ReactionCount FROM FusionAll GROUP BY E ORDER BY ReactionCount DESC',
  ]

  const executeQuery = () => {
    if (!db || !sqlQuery.trim()) return

    setIsExecuting(true)
    setError(null)

    try {
      const start = performance.now()
      const result = db.exec(sqlQuery)
      const end = performance.now()

      setResults(result)
      setQueryTime(end - start)
    } catch (err) {
      setError((err as Error).message)
      setResults(null)
    } finally {
      setIsExecuting(false)
    }
  }

  const exportToCSV = () => {
    if (!results || results.length === 0) return

    const result = results[0]
    const headers = result.columns
    const csvContent = [
      headers.join(','),
      ...result.values.map((row: any[]) => row.map(v =>
        typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      ).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_results_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (dbLoading) {
    return <DatabaseLoadingCard downloadProgress={downloadProgress} />
  }

  // Throw error to ErrorBoundary so it renders outside Layout (without sidebar)
  if (dbError) {
    throw dbError
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">All Tables Query Tool</h1>
        <p className="text-gray-600 dark:text-gray-400">Execute custom SQL queries across all reaction and property tables</p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SQL Query Editor</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Enter SQL Query
          </label>
          <textarea
            className="input font-mono text-sm"
            rows={6}
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="SELECT * FROM TableName WHERE ..."
          />
        </div>

        <div className="flex gap-3">
          <button
            className="btn btn-primary px-6 py-2"
            onClick={executeQuery}
            disabled={isExecuting || !sqlQuery.trim()}
          >
            {isExecuting ? (
              <>
                <Loader className="w-4 h-4 mr-2 inline animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2 inline" />
                Execute Query
              </>
            )}
          </button>
          <button
            onClick={() => {
              setSqlQuery('')
              setResults(null)
              setError(null)
            }}
            className="btn btn-secondary px-6 py-2"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-6 mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">Query Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 font-mono">{error}</p>
            </div>
          </div>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Query Results: {results[0].values.length} rows
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Executed in {queryTime.toFixed(2)}ms
              </p>
            </div>
            <button
              onClick={exportToCSV}
              className="btn btn-secondary px-4 py-2 text-sm"
            >
              <Download className="w-4 h-4 mr-2 inline" />
              Export CSV
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {results[0].columns.map((col: string, idx: number) => (
                    <th key={idx}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results[0].values.map((row: any[], rowIdx: number) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx}>
                        {cell === null ? (
                          <span className="text-gray-400 dark:text-gray-500 italic">null</span>
                        ) : typeof cell === 'number' ? (
                          cell.toFixed(cell % 1 === 0 ? 0 : 2)
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && results.length === 0 && !error && (
        <div className="card p-6 mb-6 bg-gray-50 dark:bg-gray-800">
          <p className="text-gray-600 dark:text-gray-400">Query executed successfully but returned no results.</p>
        </div>
      )}

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Example Queries</h3>
        </div>
        <div className="space-y-2">
          {exampleQueries.map((query, idx) => (
            <button
              key={idx}
              onClick={() => setSqlQuery(query)}
              className="block w-full text-left p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm font-mono text-gray-700 dark:text-gray-300 transition-colors"
            >
              {query}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6 bg-blue-50 dark:bg-blue-900/30">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Available Tables</h3>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <li>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded font-semibold">FusionAll</code>
              <span className="text-gray-600 dark:text-gray-400 ml-2">- Fusion reactions (E1 + E → E)</span>
            </li>
            <li>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded font-semibold">FissionAll</code>
              <span className="text-gray-600 dark:text-gray-400 ml-2">- Fission reactions (E → E1 + E2)</span>
            </li>
            <li>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded font-semibold">TwoToTwoAll</code>
              <span className="text-gray-600 dark:text-gray-400 ml-2">- 2-to-2 reactions (E1 + E2 → E3 + E4)</span>
            </li>
            <li>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded font-semibold">NuclidesPlus</code>
              <span className="text-gray-600 dark:text-gray-400 ml-2">- Nuclear isotope properties</span>
            </li>
            <li>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded font-semibold">ElementsPlus</code>
              <span className="text-gray-600 dark:text-gray-400 ml-2">- Chemical element properties</span>
            </li>
          </ul>
        </div>

        <div className="card p-6 bg-yellow-50 dark:bg-yellow-900/30">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">SQL Tips</h3>
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-disc list-inside">
            <li>Use <code className="bg-white dark:bg-gray-700 px-1 rounded">IN</code> for multiple values: <code className="bg-white dark:bg-gray-700 px-1 rounded">E IN ('H','D','Li')</code></li>
            <li>Always include <code className="bg-white dark:bg-gray-700 px-1 rounded">LIMIT</code> for large queries (max 1000)</li>
            <li>Common fields: <code className="bg-white dark:bg-gray-700 px-1 rounded">E, Z, A, MeV, neutrino</code></li>
            <li>Use <code className="bg-white dark:bg-gray-700 px-1 rounded">GROUP BY</code> for aggregations</li>
            <li>String comparisons use double quotes: <code className="bg-white dark:bg-gray-700 px-1 rounded">"H"</code></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
