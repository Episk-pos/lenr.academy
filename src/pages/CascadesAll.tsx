import { useState } from 'react'
import { Play, Settings, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useCascadeWorker } from '../hooks/useCascadeWorker'
import CascadeProgressCard from '../components/CascadeProgressCard'
import type { CascadeResults } from '../types'

export default function CascadesAll() {
  const { db } = useDatabase()
  const { runCascade, cancelCascade, progress, isRunning, error: workerError } = useCascadeWorker()

  const [params, setParams] = useState({
    temperature: 2400,
    minFusionMeV: 1.0,
    minTwoToTwoMeV: 1.0,
    maxNuclides: 50,
    maxLoops: 2,
    feedbackBosons: true,
    feedbackFermions: true,
    allowDimers: true,
    excludeMelted: false,
    excludeBoiledOff: false,
  })

  const [fuelNuclides, setFuelNuclides] = useState('H1, Li7, Al27, N14, Ni58, Ni60, Ni62, B10, B11')
  const [results, setResults] = useState<CascadeResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRunSimulation = async () => {
    if (!db) {
      setError('Database not loaded yet. Please wait...')
      return
    }

    setError(null)
    setResults(null)

    try {
      // Parse fuel nuclides from textarea
      const nuclideList = fuelNuclides
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      if (nuclideList.length === 0) {
        throw new Error('Please enter at least one fuel nuclide')
      }

      // Export database to ArrayBuffer for worker
      const dbBuffer = db.export().buffer

      // Run cascade in worker
      const cascadeResults = await runCascade({
        fuelNuclides: nuclideList,
        ...params,
      }, dbBuffer)

      setResults(cascadeResults)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(message)
      console.error('Cascade simulation error:', err)
    }
  }

  const handleReset = () => {
    setParams({
      temperature: 2400,
      minFusionMeV: 1.0,
      minTwoToTwoMeV: 1.0,
      maxNuclides: 50,
      maxLoops: 2,
      feedbackBosons: true,
      feedbackFermions: true,
      allowDimers: true,
      excludeMelted: false,
      excludeBoiledOff: false,
    })
    setFuelNuclides('H1, Li7, Al27, N14, Ni58, Ni60, Ni62, B10, B11')
    setResults(null)
    setError(null)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Cascade Simulations</h1>
        <p className="text-gray-600 dark:text-gray-400">Model cascading chain reactions from initial fuel nuclides</p>
      </div>

      <div className="card p-6 mb-6 bg-orange-50 dark:bg-orange-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Note:</strong> Cascade simulations are computationally intensive.
            Start with conservative settings (max 50 nuclides, 2-3 loops) to prevent timeouts.
            Processing time typically ranges from 30 seconds to 15 minutes depending on parameters.
          </div>
        </div>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Fuel Nuclides</h2>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Enter fuel nuclides (comma-separated)
        </label>
        <textarea
          className="input"
          rows={3}
          value={fuelNuclides}
          onChange={(e) => setFuelNuclides(e.target.value)}
          placeholder="e.g., H1, D2, Li7, Ni58"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Format: ElementSymbol + MassNumber (e.g., H1 for protium, D2 for deuterium)
        </p>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cascade Parameters</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Temperature (K)
            </label>
            <input
              type="number"
              className="input"
              value={params.temperature}
              onChange={(e) => setParams({...params, temperature: parseInt(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Fusion Energy (MeV)
            </label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={params.minFusionMeV}
              onChange={(e) => setParams({...params, minFusionMeV: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum 2-2 Energy (MeV)
            </label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={params.minTwoToTwoMeV}
              onChange={(e) => setParams({...params, minTwoToTwoMeV: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Nuclides to Pair
            </label>
            <input
              type="number"
              className="input"
              value={params.maxNuclides}
              onChange={(e) => setParams({...params, maxNuclides: parseInt(e.target.value)})}
              max={100}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recommended: 50-100</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Cascade Loops
            </label>
            <input
              type="number"
              className="input"
              value={params.maxLoops}
              onChange={(e) => setParams({...params, maxLoops: parseInt(e.target.value)})}
              max={5}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Recommended: 2-3</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Feedback Options</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.feedbackBosons}
                onChange={(e) => setParams({...params, feedbackBosons: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Feedback Bosons</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.feedbackFermions}
                onChange={(e) => setParams({...params, feedbackFermions: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Feedback Fermions</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.allowDimers}
                onChange={(e) => setParams({...params, allowDimers: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Allow Dimer Formation (H, N, O, F, Cl, Br, I)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.excludeMelted}
                onChange={(e) => setParams({...params, excludeMelted: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Exclude elements below melting point</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={params.excludeBoiledOff}
                onChange={(e) => setParams({...params, excludeBoiledOff: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Exclude elements that boiled off</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          className="btn btn-primary px-8 py-3"
          onClick={handleRunSimulation}
          disabled={isRunning || !db}
        >
          {isRunning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 inline animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2 inline" />
              Run Cascade Simulation
            </>
          )}
        </button>
        <button
          className="btn btn-secondary px-8 py-3"
          onClick={handleReset}
          disabled={isRunning}
        >
          Reset Parameters
        </button>
      </div>

      {/* Progress Display */}
      {isRunning && progress && (
        <div className="mt-6">
          <CascadeProgressCard progress={progress} onCancel={cancelCascade} />
        </div>
      )}

      {/* Error Display */}
      {(error || workerError) && (
        <div className="card p-6 mt-6 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-200">{error || workerError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="mt-6 space-y-6">
          {/* Summary Card */}
          <div className="card p-6 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                  Cascade Complete
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Reactions Found</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.reactions.length}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Loops Executed</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.loopsExecuted}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Energy</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.totalEnergy.toFixed(2)} MeV
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Execution Time</span>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.executionTime.toFixed(0)} ms
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Termination: </span>
                  {results.terminationReason === 'max_loops' && 'Reached maximum loops'}
                  {results.terminationReason === 'no_new_products' && 'No new products generated'}
                  {results.terminationReason === 'max_nuclides' && 'Reached maximum nuclides limit'}
                </div>
              </div>
            </div>
          </div>

          {/* Reactions Table */}
          {results.reactions.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Cascade Reactions ({results.reactions.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    <tr>
                      <th className="px-4 py-2 text-left">Loop</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Inputs</th>
                      <th className="px-4 py-2 text-left">Outputs</th>
                      <th className="px-4 py-2 text-right">Energy (MeV)</th>
                      <th className="px-4 py-2 text-left">Neutrino</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-900 dark:text-gray-100">
                    {results.reactions.map((reaction, idx) => (
                      <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-4 py-2">{reaction.loop}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            reaction.type === 'fusion'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                          }`}>
                            {reaction.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono">{reaction.inputs.join(' + ')}</td>
                        <td className="px-4 py-2 font-mono">{reaction.outputs.join(' + ')}</td>
                        <td className="px-4 py-2 text-right font-mono">{reaction.MeV.toFixed(3)}</td>
                        <td className="px-4 py-2">{reaction.neutrino}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Product Distribution */}
          {results.productDistribution.size > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Product Distribution ({results.productDistribution.size} unique nuclides)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from(results.productDistribution.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([nuclide, count]) => (
                    <div
                      key={nuclide}
                      className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded text-center"
                    >
                      <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                        {nuclide}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {count}×
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* No Reactions Found */}
          {results.reactions.length === 0 && (
            <div className="card p-6 bg-yellow-50 dark:bg-yellow-900/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                    No Reactions Found
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-200">
                    No reactions were found matching your energy thresholds and fuel nuclides.
                    Try adjusting your parameters or adding more fuel nuclides.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card p-6 mt-6 bg-blue-50 dark:bg-blue-900/30">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How Cascades Work</h3>
        <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
          <li>Start with your specified fuel nuclides</li>
          <li>Find all possible Fusion and 2-2 reactions between these nuclides</li>
          <li>Products meeting energy/temperature criteria are "fed back" as new reactants</li>
          <li>Process repeats recursively up to the max loop count</li>
          <li>Results show the full cascade of reactions and final product distribution</li>
        </ol>
      </div>
    </div>
  )
}
