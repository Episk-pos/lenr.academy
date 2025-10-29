import { useState, useEffect } from 'react'
import { Play, Settings, AlertCircle, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useQueryState } from '../contexts/QueryStateContext'
import { useCascadeWorker } from '../hooks/useCascadeWorker'
import CascadeProgressCard from '../components/CascadeProgressCard'
import CascadeTabs from '../components/CascadeTabs'
import PeriodicTableSelector from '../components/PeriodicTableSelector'
import { getAllElements } from '../services/queryService'
import type { CascadeResults, Element, FuelNuclide } from '../types'
import { createEqualProportionFuel } from '../utils/fuelProportions'

export default function CascadesAll() {
  const { db } = useDatabase()
  const { getCascadeState, updateCascadeState } = useQueryState()
  const { runCascade, cancelCascade, progress, isRunning, error: workerError } = useCascadeWorker()
  const [hasRestoredFromContext, setHasRestoredFromContext] = useState(false)

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

  const [availableElements, setAvailableElements] = useState<Element[]>([])
  const [fuelNuclides, setFuelNuclides] = useState<string[]>(['H-1', 'Li-7', 'Al-27', 'N-14', 'Ni-58', 'Ni-60', 'Ni-62', 'B-10', 'B-11'])
  const [useWeightedMode, setUseWeightedMode] = useState(false)
  const [fuelProportions, setFuelProportions] = useState<FuelNuclide[]>([])
  const [results, setResults] = useState<CascadeResults | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load available elements and restore state when database is ready
  useEffect(() => {
    if (db) {
      try {
        const elements = getAllElements(db)
        setAvailableElements(elements)
      } catch (err) {
        console.error('Failed to load elements from database:', err)
        // Database might not be properly initialized yet
        return
      }

      // Restore state from context if not already done
      if (!hasRestoredFromContext) {
        const savedState = getCascadeState()
        if (savedState) {
          setParams({
            temperature: savedState.temperature,
            minFusionMeV: savedState.minFusionMeV,
            minTwoToTwoMeV: savedState.minTwoToTwoMeV,
            maxNuclides: savedState.maxNuclides,
            maxLoops: savedState.maxLoops,
            feedbackBosons: savedState.feedbackBosons,
            feedbackFermions: savedState.feedbackFermions,
            allowDimers: savedState.allowDimers,
            excludeMelted: savedState.excludeMelted,
            excludeBoiledOff: savedState.excludeBoiledOff,
          })
          setSliderMaxNuclides(savedState.maxNuclides)
          setSliderMaxLoops(savedState.maxLoops)
          setFuelNuclides(savedState.fuelNuclides)

          // Restore weighted mode and proportions
          if (savedState.useWeightedMode !== undefined) {
            setUseWeightedMode(savedState.useWeightedMode)
          }
          if (savedState.fuelProportions) {
            setFuelProportions(savedState.fuelProportions)
          }

          // Restore simulation results if available
          if (savedState.results) {
            setResults(savedState.results)
          }
        }
        setHasRestoredFromContext(true)
      }
    }
  }, [db, hasRestoredFromContext, getCascadeState])

  // Save state to context whenever it changes
  useEffect(() => {
    if (!hasRestoredFromContext) return

    updateCascadeState({
      temperature: params.temperature,
      minFusionMeV: params.minFusionMeV,
      minTwoToTwoMeV: params.minTwoToTwoMeV,
      maxNuclides: params.maxNuclides,
      maxLoops: params.maxLoops,
      feedbackBosons: params.feedbackBosons,
      feedbackFermions: params.feedbackFermions,
      allowDimers: params.allowDimers,
      excludeMelted: params.excludeMelted,
      excludeBoiledOff: params.excludeBoiledOff,
      fuelNuclides,
      useWeightedMode,
      fuelProportions: fuelProportions.length > 0 ? fuelProportions : undefined,
      results: results || undefined,
    })
  }, [
    hasRestoredFromContext,
    params.temperature,
    params.minFusionMeV,
    params.minTwoToTwoMeV,
    params.maxNuclides,
    params.maxLoops,
    params.feedbackBosons,
    params.feedbackFermions,
    params.allowDimers,
    params.excludeMelted,
    params.excludeBoiledOff,
    fuelNuclides,
    useWeightedMode,
    fuelProportions,
    results,
    updateCascadeState,
  ])

  const handleRunSimulation = async () => {
    if (!db) {
      setError('Database not loaded yet. Please wait...')
      return
    }

    setError(null)
    setResults(null)

    try {
      // Validate fuel nuclides
      if (fuelNuclides.length === 0) {
        throw new Error('Please select at least one fuel nuclide')
      }

      // Prepare fuel input based on mode
      const fuelInput = useWeightedMode && fuelProportions.length > 0
        ? fuelProportions
        : fuelNuclides

      // Export database to ArrayBuffer for worker
      const dbBuffer = db.export().buffer

      // Run cascade in worker
      const cascadeResults = await runCascade({
        fuelNuclides: fuelInput,
        useWeightedMode: useWeightedMode,
        ...params,
      }, dbBuffer as ArrayBuffer)

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
    setFuelNuclides(['H-1', 'Li-7', 'Al-27', 'N-14', 'Ni-58', 'Ni-60', 'Ni-62', 'B-10', 'B-11'])
    setResults(null)
    setError(null)
  }

  const handleDownloadCSV = () => {
    if (!results) return

    // Build CSV content
    const lines: string[] = []

    // Fuel composition (if weighted mode)
    if (results.fuelComposition && results.isWeighted) {
      lines.push('Fuel Composition')
      lines.push('Nuclide,Proportion (%)')
      results.fuelComposition.forEach((fuel) => {
        lines.push(`${fuel.nuclideId},${(fuel.proportion * 100).toFixed(2)}`)
      })
      lines.push('')
    }

    // Header
    const header = results.isWeighted
      ? 'Loop,Type,Input1,Input2,Output1,Output2,Energy_MeV,Neutrino,Weight'
      : 'Loop,Type,Input1,Input2,Output1,Output2,Energy_MeV,Neutrino'
    lines.push(header)

    // Reactions
    results.reactions.forEach((reaction) => {
      const input1 = reaction.inputs[0] || ''
      const input2 = reaction.inputs[1] || ''
      const output1 = reaction.outputs[0] || ''
      const output2 = reaction.outputs[1] || ''
      const weightStr = reaction.weight !== undefined ? `,${reaction.weight.toFixed(6)}` : ''
      lines.push(
        `${reaction.loop},${reaction.type},${input1},${input2},${output1},${output2},${reaction.MeV},${reaction.neutrino}${weightStr}`
      )
    })

    // Add blank line
    lines.push('')
    lines.push('Product Distribution')
    const countLabel = results.isWeighted ? 'Weighted Count' : 'Count'
    lines.push(`Nuclide,${countLabel}`)

    // Product distribution
    Array.from(results.productDistribution.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([nuclide, count]) => {
        const countStr = results.isWeighted ? count.toFixed(4) : count.toString()
        lines.push(`${nuclide},${countStr}`)
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
        <PeriodicTableSelector
          label="Select specific isotopes for your fuel mixture"
          availableElements={availableElements}
          selectedElements={fuelNuclides}
          onSelectionChange={(nuclides) => {
            setFuelNuclides(nuclides)
            // Auto-update proportions when nuclides change in weighted mode
            if (useWeightedMode) {
              setFuelProportions(createEqualProportionFuel(nuclides))
            }
          }}
          mode="nuclide"
          disableHydrogenIsotopes={true}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Click on elements to select specific isotopes. Color coding indicates natural abundance.
        </p>

        {/* Weighted Mode Toggle */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <label htmlFor="cascade-weighted-mode" className="flex items-center gap-3 cursor-pointer">
            <input
              id="cascade-weighted-mode"
              name="useWeightedMode"
              type="checkbox"
              checked={useWeightedMode}
              onChange={(e) => {
                const checked = e.target.checked
                setUseWeightedMode(checked)
                if (checked && fuelNuclides.length > 0) {
                  // Initialize with equal proportions
                  setFuelProportions(createEqualProportionFuel(fuelNuclides))
                }
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Enable Weighted Proportions
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Specify realistic fuel mixture ratios (e.g., natural isotopic abundances: Li-7 92.5%, Li-6 7.5%)
              </p>
            </div>
          </label>
        </div>

        {/* Proportion Inputs */}
        {useWeightedMode && fuelNuclides.length > 0 && (
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Fuel Proportions (%)
            </h3>
            <div className="grid gap-2">
              {fuelNuclides.map((nuclide, index) => {
                const fuelData = fuelProportions.find(f => f.nuclideId === nuclide)
                const proportion = fuelData?.proportion ?? (1 / fuelNuclides.length)
                const percentage = proportion * 100

                return (
                  <div key={nuclide} className="flex items-center gap-3">
                    <label htmlFor={`cascade-proportion-${nuclide}`} className="w-20 text-sm font-mono text-gray-700 dark:text-gray-300">
                      {nuclide}
                    </label>
                    <input
                      id={`cascade-proportion-${nuclide}`}
                      name={`proportion-${nuclide}`}
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={percentage.toFixed(2)}
                      onChange={(e) => {
                        const newPercentage = parseFloat(e.target.value) || 0
                        const newProportion = newPercentage / 100

                        // Update this fuel's proportion
                        const updated = fuelNuclides.map((n, i) => {
                          if (i === index) {
                            return {
                              nuclideId: n,
                              proportion: newProportion,
                              displayValue: newPercentage,
                              format: 'percentage' as const,
                            }
                          }
                          const existing = fuelProportions.find(f => f.nuclideId === n)
                          return existing ?? {
                            nuclideId: n,
                            proportion: 1 / fuelNuclides.length,
                            displayValue: 100 / fuelNuclides.length,
                            format: 'percentage' as const,
                          }
                        })
                        setFuelProportions(updated)
                      }}
                      className="input flex-1"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-8">%</span>
                    {/* Visual bar indicator */}
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Total:
              </span>
              <span className={`text-sm font-mono ${
                Math.abs(fuelProportions.reduce((sum, f) => sum + f.proportion, 0) - 1.0) < 0.01
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {(fuelProportions.reduce((sum, f) => sum + f.proportion, 0) * 100).toFixed(2)}%
              </span>
              <button
                onClick={() => {
                  // Normalize proportions to sum to 100%
                  const sum = fuelProportions.reduce((acc, f) => acc + f.proportion, 0)
                  if (sum > 0) {
                    const normalized = fuelProportions.map(f => ({
                      ...f,
                      proportion: f.proportion / sum,
                      displayValue: (f.proportion / sum) * 100,
                    }))
                    setFuelProportions(normalized)
                  }
                }}
                className="text-xs px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors"
              >
                Normalize
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Cascade Parameters</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="cascade-temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Temperature (K)
            </label>
            <input
              id="cascade-temperature"
              name="temperature"
              type="number"
              className="input"
              value={params.temperature}
              onChange={(e) => setParams({...params, temperature: parseInt(e.target.value)})}
            />
          </div>

          <div>
            <label htmlFor="cascade-min-fusion-mev" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Fusion Energy (MeV)
            </label>
            <input
              id="cascade-min-fusion-mev"
              name="minFusionMeV"
              type="number"
              step="0.1"
              className="input"
              value={params.minFusionMeV}
              onChange={(e) => setParams({...params, minFusionMeV: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <label htmlFor="cascade-min-twotwo-mev" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum 2-2 Energy (MeV)
            </label>
            <input
              id="cascade-min-twotwo-mev"
              name="minTwoToTwoMeV"
              type="number"
              step="0.1"
              className="input"
              value={params.minTwoToTwoMeV}
              onChange={(e) => setParams({...params, minTwoToTwoMeV: parseFloat(e.target.value)})}
            />
          </div>

          <div>
            <label htmlFor="cascade-max-nuclides" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Nuclides to Pair: {sliderMaxNuclides}
            </label>
            <input
              id="cascade-max-nuclides"
              name="maxNuclides"
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
            <label htmlFor="cascade-max-loops" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Cascade Loops: {sliderMaxLoops}
            </label>
            <input
              id="cascade-max-loops"
              name="maxLoops"
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
            <label htmlFor="cascade-feedback-bosons" className="flex items-center cursor-pointer">
              <input
                id="cascade-feedback-bosons"
                name="feedbackBosons"
                type="checkbox"
                checked={params.feedbackBosons}
                onChange={(e) => setParams({...params, feedbackBosons: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Feedback Bosons</span>
            </label>
            <label htmlFor="cascade-feedback-fermions" className="flex items-center cursor-pointer">
              <input
                id="cascade-feedback-fermions"
                name="feedbackFermions"
                type="checkbox"
                checked={params.feedbackFermions}
                onChange={(e) => setParams({...params, feedbackFermions: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Feedback Fermions</span>
            </label>
            <label htmlFor="cascade-allow-dimers" className="flex items-center cursor-pointer">
              <input
                id="cascade-allow-dimers"
                name="allowDimers"
                type="checkbox"
                checked={params.allowDimers}
                onChange={(e) => setParams({...params, allowDimers: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Allow Dimer Formation (H, N, O, F, Cl, Br, I)</span>
            </label>
            <label htmlFor="cascade-exclude-melted" className="flex items-center cursor-pointer">
              <input
                id="cascade-exclude-melted"
                name="excludeMelted"
                type="checkbox"
                checked={params.excludeMelted}
                onChange={(e) => setParams({...params, excludeMelted: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Exclude elements below melting point</span>
            </label>
            <label htmlFor="cascade-exclude-boiled" className="flex items-center cursor-pointer">
              <input
                id="cascade-exclude-boiled"
                name="excludeBoiledOff"
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
            <CascadeTabs results={results} fuelNuclides={fuelNuclides} />
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

      {!results && (
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
      )}
    </div>
  )
}
