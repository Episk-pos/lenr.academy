import { useEffect, useState, useMemo } from 'react'
import { X, ChevronDown, ChevronUp, ArrowRight, Radiation } from 'lucide-react'
import type { Nuclide, DecayData, DecayChainResult } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { getRadioactiveDecayData, getElementSymbolByZ, getNuclideBySymbol } from '../services/queryService'
import { traceDecayChain } from '../services/decayChainService'
import { useNavigate, Link } from 'react-router-dom'
import { expandHalfLifeUnit } from '../utils/formatUtils'
import DecayChainDiagram from './DecayChainDiagram'

interface NuclideDetailsCardProps {
  nuclide: Nuclide | null
  onClose?: () => void
}

// Helper function to get decay mode badge styling
function getDecayModeStyle(decayMode: string): { bg: string; text: string } {
  const mode = decayMode.toUpperCase()

  if (mode.includes('A')) {
    return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' }
  }
  if (mode.includes('B-') || mode.includes('β-')) {
    return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' }
  }
  if (mode.includes('B+') || mode.includes('β+')) {
    return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' }
  }
  if (mode.includes('EC')) {
    return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' }
  }
  if (mode.includes('IT')) {
    return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' }
  }

  // Default styling for other decay modes
  return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' }
}

// Helper function to calculate daughter nuclide from decay mode
function getDaughterNuclide(Z: number, A: number, E: string, decayMode: string): { Z: number; A: number; E: string } | null {
  const mode = decayMode.toUpperCase()

  // Alpha decay: Z-2, A-4
  if (mode.includes('A') && !mode.includes('EC') && !mode.includes('B')) {
    return { Z: Z - 2, A: A - 4, E: '' } // Element symbol needs lookup
  }

  // Beta minus decay: Z+1, A stays same
  if (mode.includes('B-') || mode.includes('β-')) {
    return { Z: Z + 1, A: A, E: '' }
  }

  // Beta plus decay: Z-1, A stays same
  if (mode.includes('B+') || mode.includes('β+')) {
    return { Z: Z - 1, A: A, E: '' }
  }

  // Electron capture: Z-1, A stays same
  if (mode.includes('EC')) {
    return { Z: Z - 1, A: A, E: '' }
  }

  // Isomeric transition: same nuclide, just energy state change
  if (mode.includes('IT')) {
    return { Z: Z, A: A, E: E }
  }

  return null
}

// Comprehensive radiation type information
const RADIATION_TYPE_INFO: Record<string, { name: string; description: string; url: string; category: string }> = {
  'A': { name: 'Alpha particle', description: 'He-4 nucleus', url: 'https://en.wikipedia.org/wiki/Alpha_particle', category: 'primary' },
  'B-': { name: 'Beta minus', description: 'electron emission', url: 'https://en.wikipedia.org/wiki/Beta_decay', category: 'primary' },
  'B+': { name: 'Beta plus', description: 'positron emission', url: 'https://en.wikipedia.org/wiki/Positron_emission', category: 'primary' },
  'B': { name: 'Beta decay', description: 'unspecified sign', url: 'https://en.wikipedia.org/wiki/Beta_decay', category: 'primary' },
  'EC': { name: 'Electron capture', description: 'orbital electron absorbed', url: 'https://en.wikipedia.org/wiki/Electron_capture', category: 'primary' },
  'IT': { name: 'Isomeric transition', description: 'excited state decay', url: 'https://en.wikipedia.org/wiki/Isomeric_transition', category: 'primary' },
  'G': { name: 'Gamma ray', description: 'high-energy photon', url: 'https://en.wikipedia.org/wiki/Gamma_ray', category: 'gamma' },
  'G-AN': { name: 'Annihilation gamma', description: 'positron annihilation', url: 'https://en.wikipedia.org/wiki/Electron%E2%80%93positron_annihilation', category: 'gamma' },
  'G-X-K': { name: 'K-shell X-ray', description: 'K shell transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-KA1': { name: 'Kα1 X-ray', description: 'K shell α1 transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-KA2': { name: 'Kα2 X-ray', description: 'K shell α2 transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-KB': { name: 'Kβ X-ray', description: 'K shell β transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'G-X-L': { name: 'L-shell X-ray', description: 'L shell transition', url: 'https://en.wikipedia.org/wiki/Characteristic_X-ray', category: 'xray' },
  'E-CE-K': { name: 'K-shell conversion electron', description: 'internal conversion from K shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-L': { name: 'L-shell conversion electron', description: 'internal conversion from L shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-M': { name: 'M-shell conversion electron', description: 'internal conversion from M shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-M+': { name: 'M+ shell conversion electron', description: 'internal conversion from M+ shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-MN+': { name: 'MN+ shell conversion electron', description: 'internal conversion from MN+ shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-CE-N+': { name: 'N+ shell conversion electron', description: 'internal conversion from N+ shell', url: 'https://en.wikipedia.org/wiki/Internal_conversion', category: 'electron' },
  'E-AU-K': { name: 'K-shell Auger electron', description: 'atomic de-excitation from K shell', url: 'https://en.wikipedia.org/wiki/Auger_effect', category: 'electron' },
  'E-AU-L': { name: 'L-shell Auger electron', description: 'atomic de-excitation from L shell', url: 'https://en.wikipedia.org/wiki/Auger_effect', category: 'electron' },
}

export default function NuclideDetailsCard({ nuclide, onClose }: NuclideDetailsCardProps) {
  const { db } = useDatabase()
  const navigate = useNavigate()
  const [decayData, setDecayData] = useState<DecayData[]>([])
  const [showFullDecayTable, setShowFullDecayTable] = useState(false)
  const [decayChain, setDecayChain] = useState<DecayChainResult | null>(null)
  const [showDecayChain, setShowDecayChain] = useState(false)
  const [chainDepth, setChainDepth] = useState(5)
  const [minBranchingRatio, setMinBranchingRatio] = useState(10)

  useEffect(() => {
    if (!nuclide || !db) {
      setDecayData([])
      setDecayChain(null)
      return
    }

    const data = getRadioactiveDecayData(db, nuclide.Z, nuclide.A)
    setDecayData(data)

    // Build decay chain if nuclide is radioactive
    if (data.length > 0) {
      try {
        const chain = traceDecayChain(db, nuclide.Z, nuclide.A, {
          maxDepth: chainDepth,
          minBranchingRatio
        })
        setDecayChain(chain)
      } catch (error) {
        console.error('Error tracing decay chain:', error)
        setDecayChain(null)
      }
    } else {
      setDecayChain(null)
    }
  }, [nuclide, db, chainDepth, minBranchingRatio])

  // Compute unique radiation types and decay modes present in the decay data
  const uniqueRadiationTypes = useMemo(() => {
    const types = new Set<string>()
    decayData.forEach(decay => {
      // Include decay modes (e.g., IT, B-, EC) so users understand the "Decay Mode" column
      if (decay.decayMode) {
        types.add(decay.decayMode)
      }
      // Include radiation types (e.g., G, E-AU-L) so users understand the "Radiation" column
      if (decay.radiationType) {
        types.add(decay.radiationType)
      }
    })
    return Array.from(types).sort()
  }, [decayData])

  // Handler to navigate to daughter nuclide
  const handleDecayClick = (decayMode: string) => {
    if (!db || !nuclide) return

    const daughter = getDaughterNuclide(nuclide.Z, nuclide.A, nuclide.E, decayMode)
    if (!daughter) return

    // Get element symbol if not provided
    const daughterE = daughter.E || getElementSymbolByZ(db, daughter.Z)
    if (!daughterE) return

    // Check if daughter nuclide exists in database (for informational purposes only)
    const daughterNuclide = getNuclideBySymbol(db, daughterE, daughter.A)
    if (!daughterNuclide) {
      console.warn(`Daughter nuclide ${daughterE}-${daughter.A} not found in database, but navigating anyway`)
    }

    // Always navigate, even if the daughter nuclide doesn't exist in the database
    // The ShowElementData page will handle displaying appropriate messages
    navigate(`/element-data?Z=${daughter.Z}&A=${daughter.A}`)
  }

  if (!nuclide) return null

  return (
    <div className="card p-6 animate-fade-in max-w-full overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Link
              to={`/element-data?Z=${nuclide.Z}&A=${nuclide.A}`}
              className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
            >
              {nuclide.E}-{nuclide.A}
            </Link>
            {decayData.length > 0 && (
              <span title="Radioactive">
                <Radiation className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Atomic Number: {nuclide.Z} • Mass Number: {nuclide.A}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close nuclide details"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Nuclear Properties
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Element:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.E}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Protons (Z):</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.Z}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Mass Number (A):</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.A}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Neutrons (N):</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.A - nuclide.Z}</dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Quantum Properties
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-gray-600 dark:text-gray-400">Nuclear Type:</dt>
              <dd>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  nuclide.nBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                }`}>
                  {nuclide.nBorF === 'b' ? 'Boson' : 'Fermion'}
                </span>
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-600 dark:text-gray-400">Atomic Type:</dt>
              <dd>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  nuclide.aBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                }`}>
                  {nuclide.aBorF === 'b' ? 'Boson' : 'Fermion'}
                </span>
              </dd>
            </div>
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
              Nuclear: {nuclide.nBorF === 'b' ? 'Even A' : 'Odd A'}<br />
              Atomic: {nuclide.aBorF === 'b' ? 'Even N' : 'Odd N'}
            </div>
          </dl>
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Energy & Mass
          </h3>
          <dl className="space-y-2 text-sm overflow-hidden">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Binding Energy:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                {nuclide.BE.toFixed(3)} MeV
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">BE per Nucleon:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                {(nuclide.BE / nuclide.A).toFixed(3)} MeV
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Atomic Mass:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                {nuclide.AMU.toFixed(6)} amu
              </dd>
            </div>
          </dl>
        </div>

        {typeof nuclide.logHalfLife === 'number' && !isNaN(nuclide.logHalfLife) && (
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              Stability
            </h3>
            <dl className="space-y-2 text-sm overflow-hidden">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Log₁₀ Half-life:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                  {nuclide.logHalfLife.toFixed(2)} years
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">Half-life:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                  {Math.pow(10, nuclide.logHalfLife).toExponential(2)} years
                </dd>
              </div>
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-300 break-words">
                {nuclide.logHalfLife > 9 ? 'Stable or very long-lived' :
                 nuclide.logHalfLife > 0 ? 'Radioactive' :
                 'Short-lived radioactive'}
              </div>
            </dl>
          </div>
        )}

        {decayData.length > 0 && (
          <div className="md:col-span-2 lg:col-span-3">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              Radioactive Decay
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-max text-xs border border-gray-200 dark:border-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="pl-6 pr-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Decay Mode</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Radiation</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Energy (MeV)</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Intensity (%)</th>
                    <th className="pl-3 pr-6 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Half-life</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {/* Show first 4 decay modes */}
                  {decayData.slice(0, 4).map((decay, idx) => {
                    const style = getDecayModeStyle(decay.decayMode)
                    const daughter = getDaughterNuclide(nuclide.Z, nuclide.A, nuclide.E, decay.decayMode)
                    const hasDaughter = daughter !== null
                    const daughterE = hasDaughter && db ? (daughter!.E || getElementSymbolByZ(db, daughter!.Z)) : null

                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="pl-6 pr-3 py-2">
                          <button
                            onClick={() => handleDecayClick(decay.decayMode)}
                            disabled={!hasDaughter}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} ${
                              hasDaughter ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default opacity-70'
                            } flex items-center gap-1`}
                            title={hasDaughter ? `View daughter nuclide` : 'Decay mode'}
                          >
                            {decay.decayMode}
                            {hasDaughter && (
                              <>
                                <ArrowRight className="w-3 h-3" />
                                <span>{daughterE}-{daughter!.A}</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{decay.radiationType}</td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.energyKeV !== null ? (decay.energyKeV / 1000).toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.intensity !== null ? decay.intensity.toFixed(1) : '—'}
                        </td>
                        <td className="pl-3 pr-6 py-2 text-gray-900 dark:text-gray-100">
                          {decay.halfLife !== null && decay.halfLifeUnits !== null
                            ? decay.halfLife >= 10000
                              ? `${decay.halfLife.toExponential(2)} ${expandHalfLifeUnit(decay.halfLifeUnits)}`
                              : `${decay.halfLife} ${expandHalfLifeUnit(decay.halfLifeUnits)}`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Toggle button row */}
                  {decayData.length > 4 && (
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td colSpan={5} className="px-3 py-2 text-center">
                        <button
                          onClick={() => setShowFullDecayTable(!showFullDecayTable)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {showFullDecayTable ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              Hide {decayData.length - 4} additional decay mode{decayData.length - 4 !== 1 ? 's' : ''}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              Show {decayData.length - 4} more decay mode{decayData.length - 4 !== 1 ? 's' : ''}
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Additional decay modes when expanded */}
                  {showFullDecayTable && decayData.length > 4 && decayData.slice(4).map((decay, idx) => {
                    const style = getDecayModeStyle(decay.decayMode)
                    const daughter = getDaughterNuclide(nuclide.Z, nuclide.A, nuclide.E, decay.decayMode)
                    const hasDaughter = daughter !== null
                    const daughterE = hasDaughter && db ? (daughter!.E || getElementSymbolByZ(db, daughter!.Z)) : null

                    return (
                      <tr key={idx + 4} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                        <td className="pl-6 pr-3 py-2">
                          <button
                            onClick={() => handleDecayClick(decay.decayMode)}
                            disabled={!hasDaughter}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} ${
                              hasDaughter ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default opacity-70'
                            } flex items-center gap-1`}
                            title={hasDaughter ? `View daughter nuclide` : 'Decay mode'}
                          >
                            {decay.decayMode}
                            {hasDaughter && (
                              <>
                                <ArrowRight className="w-3 h-3" />
                                <span>{daughterE}-{daughter!.A}</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{decay.radiationType}</td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.energyKeV !== null ? (decay.energyKeV / 1000).toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.intensity !== null ? decay.intensity.toFixed(1) : '—'}
                        </td>
                        <td className="pl-3 pr-6 py-2 text-gray-900 dark:text-gray-100">
                          {decay.halfLife !== null && decay.halfLifeUnits !== null
                            ? decay.halfLife >= 10000
                              ? `${decay.halfLife.toExponential(2)} ${expandHalfLifeUnit(decay.halfLifeUnits)}`
                              : `${decay.halfLife} ${expandHalfLifeUnit(decay.halfLifeUnits)}`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 text-sm">
          About Boson/Fermion Classification
        </h3>
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          <strong>Nuclear:</strong> Determined by mass number (A). Even A = Boson, Odd A = Fermion.<br />
          <strong>Atomic:</strong> Determined by neutron count (N = A - Z). Even N = Boson, Odd N = Fermion.<br />
          This classification affects quantum statistical behavior and reaction probabilities.
        </p>
      </div>

      {decayData.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">
            Radiation Type Legend
          </h3>
          <div className="grid md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-800 dark:text-amber-300">
            {uniqueRadiationTypes.map(type => {
              const info = RADIATION_TYPE_INFO[type]
              if (!info) return null
              return (
                <div key={type}>
                  <strong>{type}:</strong>{' '}
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
                  >
                    {info.name}
                  </a>
                  {' '}({info.description})
                </div>
              )
            })}
            <div className="md:col-span-2 mt-1 text-xs opacity-80">
              Shell designations: K (innermost), L, M, N (outer shells)
            </div>
          </div>
        </div>
      )}

      {/* Decay Chain Visualization */}
      {decayChain && decayChain.totalGenerations > 0 && (
        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
              Decay Chain Visualization
            </h3>
            <button
              onClick={() => setShowDecayChain(!showDecayChain)}
              className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              {showDecayChain ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Hide Chain
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show Chain ({decayChain.totalGenerations} generation{decayChain.totalGenerations !== 1 ? 's' : ''}, {decayChain.branchCount} branch{decayChain.branchCount !== 1 ? 'es' : ''})
                </>
              )}
            </button>
          </div>

          {showDecayChain && (
            <>
              {/* Controls */}
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                    Max Depth: {chainDepth} generations
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={chainDepth}
                    onChange={(e) => setChainDepth(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-200 dark:bg-purple-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                    Min Branching Ratio: {minBranchingRatio}%
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={minBranchingRatio}
                    onChange={(e) => setMinBranchingRatio(parseInt(e.target.value))}
                    className="w-full h-2 bg-purple-200 dark:bg-purple-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Chain Info */}
              <div className="text-xs text-purple-800 dark:text-purple-300 mb-4 space-y-1">
                <div><strong>Total Generations:</strong> {decayChain.totalGenerations}</div>
                <div><strong>Branch Count:</strong> {decayChain.branchCount}</div>
                <div>
                  <strong>Terminal Nuclides:</strong> {decayChain.terminalNuclides.map(n => `${n.E}-${n.A}`).join(', ')}
                  {' '}
                  ({decayChain.terminalNuclides.filter(n => n.isStable).length} stable,{' '}
                  {decayChain.terminalNuclides.filter(n => !n.isStable).length} radioactive)
                </div>
              </div>

              {/* Diagram */}
              <DecayChainDiagram root={decayChain.root} maxHeight={300} />
            </>
          )}
        </div>
      )}
    </div>
  )
}
