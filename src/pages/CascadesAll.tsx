import { useState, useEffect } from 'react'
import { Play, Settings, AlertCircle, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useCascadeWorker } from '../hooks/useCascadeWorker'
import CascadeProgressCard from '../components/CascadeProgressCard'
import CascadeTabs from '../components/CascadeTabs'
import CascadeNetworkDiagram from '../components/CascadeNetworkDiagram'
import type { CascadeResults } from '../types'

export default function CascadesAll() {
  const { db } = useDatabase()
  const { runCascade, cancelCascade, progress, isRunning, error: workerError } = useCascadeWorker()

  const [params, setParams] = useState({
    temperature: 2400,
    minFusionMeV: 1.0,
    minTwoToTwoMeV: 1.0,
    maxNuclides: 5000,
    maxLoops: 25,
    feedbackBosons: true,
    feedbackFermions: true,
    allowDimers: true,
    excludeMelted: false,
    excludeBoiledOff: true,
  })

  // Local state for sliders during dragging (prevents performance issues)
  const [sliderMaxNuclides, setSliderMaxNuclides] = useState(5000)
  const [sliderMaxLoops, setSliderMaxLoops] = useState(25)

  const [fuelNuclides, setFuelNuclides] = useState('H1, Li7, Al27, N14, Ni58, Ni60, Ni62, B10, B11')
  const [parsedFuelNuclides, setParsedFuelNuclides] = useState<string[]>([])
  const [results, setResults] = useState<CascadeResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Track incremental reactions during simulation for real-time visualization
  const [liveReactions, setLiveReactions] = useState<any[]>([])

  // Update live reactions when progress includes new reactions
  useEffect(() => {
    if (progress?.newReactions && progress.newReactions.length > 0) {
      setLiveReactions((prev) => [...prev, ...progress.newReactions!])
    }
  }, [progress])

  const handleRunSimulation = async () => {
    if (!db) {
      setError('Database not loaded yet. Please wait...')
      return
    }

    setError(null)
    setResults(null)
    setLiveReactions([])

    try {
      // Parse fuel nuclides from textarea
      const nuclideList = fuelNuclides
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      if (nuclideList.length === 0) {
        throw new Error('Please enter at least one fuel nuclide')
      }

      // Store parsed fuel nuclides for visualization
      setParsedFuelNuclides(nuclideList)

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
      maxNuclides: 5000,
      maxLoops: 25,
      feedbackBosons: true,
      feedbackFermions: true,
      allowDimers: true,
      excludeMelted: false,
      excludeBoiledOff: true,
    })
    setSliderMaxNuclides(5000)
    setSliderMaxLoops(25)
    setFuelNuclides('H1, Li7, Al27, N14, Ni58, Ni60, Ni62, B10, B11')
    setParsedFuelNuclides([])
    setResults(null)
    setError(null)
    setLiveReactions([])
  }

  const handleDownloadCSV = () => {
    if (!results) return

    // Build CSV content
    const lines: string[] = []

    // Header
    lines.push('Loop,Type,Input1,Input2,Output1,Output2,Energy_MeV,Neutrino')

    // Reactions
    results.reactions.forEach((reaction) => {
      const input1 = reaction.inputs[0] || ''
      const input2 = reaction.inputs[1] || ''
      const output1 = reaction.outputs[0] || ''
      const output2 = reaction.outputs[1] || ''
      lines.push(
        `${reaction.loop},${reaction.type},${input1},${input2},${output1},${output2},${reaction.MeV},${reaction.neutrino}`
      )
    })

    // Add blank line
    lines.push('')
    lines.push('Product Distribution')
    lines.push('Nuclide,Count')

    // Product distribution
    Array.from(results.productDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([nuclide, count]) => {
        lines.push(`${nuclide},${count}`)
      })

    // Create blob and download
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `cascade_results_${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Cascade Simulations</h1>
        <p className="text-gray-600 dark:text-gray-400">Model cascading chain reactions from initial fuel nuclides</p>
      </div>

      <div className="card p-6 mb-6 bg-blue-50 dark:bg-blue-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Database-driven limits:</strong> The database contains 324 nuclides across 92 elements,
            with 3,921 fusion reactions and 1.2M two-to-two reactions. Slider ranges reflect these constraints.
            Default settings (5000 max nuclides, 25 loops) provide comprehensive results.
            Processing time ranges from 30 seconds to 15 minutes depending on parameters.
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
              Max Nuclides to Pair: {sliderMaxNuclides}
            </label>
            <input
              type="range"
              min="10"
              max="10000"
              step="10"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
              value={sliderMaxNuclides}
              onInput={(e) => setSliderMaxNuclides(parseInt((e.target as HTMLInputElement).value))}
              onMouseUp={(e) => setParams({...params, maxNuclides: parseInt((e.target as HTMLInputElement).value)})}
              onTouchEnd={(e) => setParams({...params, maxNuclides: parseInt((e.target as HTMLInputElement).value)})}
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>10</span>
              <span>Database has 324 total nuclides</span>
              <span>10,000</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Cascade Loops: {sliderMaxLoops}
            </label>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
              value={sliderMaxLoops}
              onInput={(e) => setSliderMaxLoops(parseInt((e.target as HTMLInputElement).value))}
              onMouseUp={(e) => setParams({...params, maxLoops: parseInt((e.target as HTMLInputElement).value)})}
              onTouchEnd={(e) => setParams({...params, maxLoops: parseInt((e.target as HTMLInputElement).value)})}
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>1</span>
              <span>Recommended: 10-50</span>
              <span>100</span>
            </div>
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
        <div className="mt-6 space-y-6">
          <CascadeProgressCard progress={progress} onCancel={cancelCascade} />

          {/* Real-time Network Visualization */}
          {liveReactions.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Live Cascade Network ({liveReactions.length} reactions so far)
              </h3>
              <CascadeNetworkDiagram reactions={liveReactions} />
            </div>
          )}
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
          {/* Completion Banner */}
          <div className="card p-6 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    Cascade Complete
                  </h3>
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV
                  </button>
                </div>
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

          {/* Tabbed Results Interface */}
          {results.reactions.length > 0 ? (
            <CascadeTabs results={results} fuelNuclides={parsedFuelNuclides} />
          ) : (
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
