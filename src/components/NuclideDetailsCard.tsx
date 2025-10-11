import { useEffect, useState } from 'react'
import { X, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import type { Nuclide, DecayData } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { getRadioactiveDecayData, getElementSymbolByZ, getNuclideBySymbol } from '../services/queryService'
import { useNavigate, Link } from 'react-router-dom'

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

export default function NuclideDetailsCard({ nuclide, onClose }: NuclideDetailsCardProps) {
  const { db } = useDatabase()
  const navigate = useNavigate()
  const [decayData, setDecayData] = useState<DecayData[]>([])
  const [showFullDecayTable, setShowFullDecayTable] = useState(false)

  useEffect(() => {
    if (!nuclide || !db) {
      setDecayData([])
      return
    }

    const data = getRadioactiveDecayData(db, nuclide.Z, nuclide.A)
    setDecayData(data)
  }, [nuclide, db])

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
    <div className="card p-6 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            <Link
              to={`/element-data?Z=${nuclide.Z}&A=${nuclide.A}`}
              className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
            >
              {nuclide.E}-{nuclide.A}
            </Link>
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
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Nuclear Properties
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Element:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.E}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Protons (Z):</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.Z}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Mass Number (A):</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.A}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Neutrons (N):</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.A - nuclide.Z}</dd>
            </div>
          </dl>
        </div>

        <div>
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

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Energy & Mass
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Binding Energy:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {nuclide.BE.toFixed(3)} MeV
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">BE per Nucleon:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {(nuclide.BE / nuclide.A).toFixed(3)} MeV
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">Atomic Mass:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {nuclide.AMU.toFixed(6)} amu
              </dd>
            </div>
          </dl>
        </div>

        {typeof nuclide.LHL === 'number' && !isNaN(nuclide.LHL) && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              Stability
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Log₁₀ Half-life:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {nuclide.LHL.toFixed(2)} years
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Half-life:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {Math.pow(10, nuclide.LHL).toExponential(2)} years
                </dd>
              </div>
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-300">
                {nuclide.LHL > 9 ? 'Stable or very long-lived' :
                 nuclide.LHL > 0 ? 'Radioactive' :
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
            <div className="space-y-2">
              {decayData.slice(0, 3).map((decay, idx) => {
                const style = getDecayModeStyle(decay.decayMode)
                const daughter = getDaughterNuclide(nuclide.Z, nuclide.A, nuclide.E, decay.decayMode)
                const hasDaughter = daughter !== null
                const daughterE = hasDaughter && db ? (daughter!.E || getElementSymbolByZ(db, daughter!.Z)) : null

                return (
                  <div key={idx} className="flex items-center gap-2">
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
                    {decay.energyKeV !== null && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {(decay.energyKeV / 1000).toFixed(2)} MeV
                      </span>
                    )}
                    {decay.intensity !== null && (
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        ({decay.intensity.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                )
              })}

              {decayData.length > 3 && (
                <button
                  onClick={() => setShowFullDecayTable(!showFullDecayTable)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2"
                >
                  {showFullDecayTable ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Hide details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Show {decayData.length - 3} more decay mode{decayData.length - 3 !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              )}

              {showFullDecayTable && decayData.length > 3 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Decay Mode</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Radiation</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Energy (MeV)</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">Intensity (%)</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Half-life</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {decayData.map((decay, idx) => {
                        const style = getDecayModeStyle(decay.decayMode)
                        const daughter = getDaughterNuclide(nuclide.Z, nuclide.A, nuclide.E, decay.decayMode)
                        const hasDaughter = daughter !== null
                        const daughterE = hasDaughter && db ? (daughter!.E || getElementSymbolByZ(db, daughter!.Z)) : null

                        return (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-2">
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
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                              {decay.halfLife !== null && decay.halfLifeUnits !== null
                                ? `${decay.halfLife} ${decay.halfLifeUnits}`
                                : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
            <div>
              <strong>A:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Alpha_particle"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Alpha particle
              </a>
              {' '}(He-4 nucleus)
            </div>
            <div>
              <strong>B-, β-:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Beta_decay"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Beta minus
              </a>
              {' '}(electron emission)
            </div>
            <div>
              <strong>B+, β+:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Positron_emission"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Beta plus
              </a>
              {' '}(positron emission)
            </div>
            <div>
              <strong>G:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Gamma_ray"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Gamma ray
              </a>
              {' '}(high-energy photon)
            </div>
            <div>
              <strong>E-CE:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Internal_conversion"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Conversion electron
              </a>
              {' '}(internal conversion)
            </div>
            <div>
              <strong>E-AU:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Auger_effect"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Auger electron
              </a>
              {' '}(atomic de-excitation)
            </div>
            <div>
              <strong>G-X:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Characteristic_X-ray"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                X-ray
              </a>
              {' '}(atomic shell transitions)
            </div>
            <div>
              <strong>G-AN:</strong>{' '}
              <a
                href="https://en.wikipedia.org/wiki/Electron%E2%80%93positron_annihilation"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-amber-900 dark:hover:text-amber-100"
              >
                Annihilation gamma
              </a>
              {' '}(positron annihilation)
            </div>
            <div className="md:col-span-2 mt-1 text-xs opacity-80">
              Shell designations: K (innermost), L, M, N (outer shells)
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
