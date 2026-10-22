import { useState, useMemo } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { getRadiationTypeInfo } from '../constants/radiationTypes'
import { X, ChevronDown, ChevronUp, ArrowRight, Radiation } from 'lucide-react'
import type { RadioactiveNuclideData } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { getElementSymbolByZ, getNuclideBySymbol } from '../services/queryService'
import { useNavigate, Link } from 'react-router-dom'
import { expandHalfLifeUnit } from '../utils/formatUtils'

interface RadioactiveNuclideCardProps {
  nuclideData: RadioactiveNuclideData
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


export default function RadioactiveNuclideCard({ nuclideData, onClose }: RadioactiveNuclideCardProps) {
  const { t } = useTranslation()
  const { db } = useDatabase()
  const navigate = useNavigate()
  const [showFullDecayTable, setShowFullDecayTable] = useState(false)

  // Compute unique radiation types and decay modes present in the decay data
  const uniqueRadiationTypes = useMemo(() => {
    const types = new Set<string>()
    nuclideData.decayData.forEach(decay => {
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
  }, [nuclideData.decayData])

  // Handler to navigate to daughter nuclide
  const handleDecayClick = (decayMode: string) => {
    if (!db) return

    const daughter = getDaughterNuclide(nuclideData.Z, nuclideData.A, nuclideData.E, decayMode)
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

  return (
    <div className="p-0 xs:p-4 sm:p-6 animate-fade-in max-w-full xs:overflow-hidden xs:rounded-lg xs:border-2 xs:border-amber-200 dark:xs:border-amber-800 xs:bg-white xs:dark:bg-gray-800 xs:text-gray-950 xs:dark:text-gray-50 xs:shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Link
              to={`/element-data?Z=${nuclideData.Z}&A=${nuclideData.A}`}
              className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
            >
              {nuclideData.E}-{nuclideData.A}
            </Link>
            <span title={t('reactions.radioactive')}>
              <Radiation className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('elements.atomicNumber')}: {nuclideData.Z} • {t('elements.massNumber')}: {nuclideData.A}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={t('elements.closeNuclideDetails')}
            aria-label={t('elements.closeNuclideDetails')}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Limited data banner */}
      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <Trans i18nKey="radioactiveCard.limitedData" components={{ strong: <strong /> }} />
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-2 xs:gap-4 sm:gap-6">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.nuclearProperties')}
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.element')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclideData.E}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.protonsZ')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclideData.Z}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.massNumberA')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclideData.A}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.neutronsN')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclideData.A - nuclideData.Z}</dd>
            </div>
          </dl>
        </div>

        {nuclideData.logHalfLife !== null && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              {t('elements.stability')}
            </h3>
            <dl className="space-y-2 text-sm overflow-hidden">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.logHalfLife')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                  {t('elements.valueYears', { value: nuclideData.logHalfLife.toFixed(2) })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.halfLife')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                  {nuclideData.halfLife !== null && nuclideData.Units !== null
                    ? nuclideData.halfLife >= 10000
                      ? `${nuclideData.halfLife.toExponential(2)} ${expandHalfLifeUnit(nuclideData.Units)}`
                      : `${nuclideData.halfLife} ${expandHalfLifeUnit(nuclideData.Units)}`
                    : t('elements.valueYears', { value: Math.pow(10, nuclideData.logHalfLife).toExponential(2) })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('radioactiveCard.primaryDecayMode')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                  <span className={`px-2 py-1 rounded-full text-xs ${getDecayModeStyle(nuclideData.RDM).bg} ${getDecayModeStyle(nuclideData.RDM).text}`}>
                    {nuclideData.RDM}
                  </span>
                </dd>
              </div>
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-300 break-words">
                {nuclideData.logHalfLife > 9 ? t('elements.stableOrLongLived') :
                 nuclideData.logHalfLife > 0 ? t('reactions.radioactive') :
                 t('elements.shortLivedRadioactive')}
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Radioactive Decay Table - isolated container */}
      {nuclideData.decayData.length > 0 && (
        <div className="mt-4 xs:mt-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.radioactiveDecay')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 dark:border-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="pl-3 pr-2 sm:pl-6 sm:pr-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.decayMode')}</th>
                    <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('radioactiveCard.radiation')}</th>
                    <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{t('reactions.energyMeV')}</th>
                    <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{t('elements.intensityPercent')}</th>
                    <th className="pl-2 pr-3 sm:pl-3 sm:pr-6 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.halfLife')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {/* Show first 4 decay modes */}
                  {nuclideData.decayData.slice(0, 4).map((decay, idx) => {
                    const style = getDecayModeStyle(decay.decayMode)
                    const daughter = getDaughterNuclide(nuclideData.Z, nuclideData.A, nuclideData.E, decay.decayMode)
                    const hasDaughter = daughter !== null
                    const daughterE = hasDaughter && db ? (daughter!.E || getElementSymbolByZ(db, daughter!.Z)) : null

                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="pl-3 pr-2 sm:pl-6 sm:pr-3 py-2">
                          <button
                            onClick={() => handleDecayClick(decay.decayMode)}
                            disabled={!hasDaughter}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} ${
                              hasDaughter ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default opacity-70'
                            } flex items-center gap-1`}
                            title={hasDaughter ? t('elements.viewDaughterNuclide') : t('elements.decayMode')}
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
                        <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-gray-100">{decay.radiationType}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.energyKeV !== null ? (decay.energyKeV / 1000).toFixed(2) : '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.intensity !== null ? decay.intensity.toFixed(1) : '—'}
                        </td>
                        <td className="pl-2 pr-3 sm:pl-3 sm:pr-6 py-2 text-gray-900 dark:text-gray-100">
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
                  {nuclideData.decayData.length > 4 && (
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td colSpan={5} className="px-3 py-2 text-center">
                        <button
                          onClick={() => setShowFullDecayTable(!showFullDecayTable)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {showFullDecayTable ? (
                            <>
                              <ChevronUp className="w-3 h-3" />
                              {nuclideData.decayData.length - 4 !== 1
                                ? t('elements.hideDecayModesPlural', { count: nuclideData.decayData.length - 4 })
                                : t('elements.hideDecayModes', { count: nuclideData.decayData.length - 4 })}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              {nuclideData.decayData.length - 4 !== 1
                                ? t('elements.showDecayModesPlural', { count: nuclideData.decayData.length - 4 })
                                : t('elements.showDecayModes', { count: nuclideData.decayData.length - 4 })}
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  )}

                  {/* Additional decay modes when expanded */}
                  {showFullDecayTable && nuclideData.decayData.length > 4 && nuclideData.decayData.slice(4).map((decay, idx) => {
                    const style = getDecayModeStyle(decay.decayMode)
                    const daughter = getDaughterNuclide(nuclideData.Z, nuclideData.A, nuclideData.E, decay.decayMode)
                    const hasDaughter = daughter !== null
                    const daughterE = hasDaughter && db ? (daughter!.E || getElementSymbolByZ(db, daughter!.Z)) : null

                    return (
                      <tr key={idx + 4} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 bg-gray-50/30 dark:bg-gray-800/20">
                        <td className="pl-3 pr-2 sm:pl-6 sm:pr-3 py-2">
                          <button
                            onClick={() => handleDecayClick(decay.decayMode)}
                            disabled={!hasDaughter}
                            className={`px-2 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} ${
                              hasDaughter ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default opacity-70'
                            } flex items-center gap-1`}
                            title={hasDaughter ? t('elements.viewDaughterNuclide') : t('elements.decayMode')}
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
                        <td className="px-2 sm:px-3 py-2 text-gray-900 dark:text-gray-100">{decay.radiationType}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.energyKeV !== null ? (decay.energyKeV / 1000).toFixed(2) : '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                          {decay.intensity !== null ? decay.intensity.toFixed(1) : '—'}
                        </td>
                        <td className="pl-2 pr-3 sm:pl-3 sm:pr-6 py-2 text-gray-900 dark:text-gray-100">
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

      {nuclideData.decayData.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">
            {t('elements.radiationTypeLegend')}
          </h3>
          <div className="grid md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-800 dark:text-amber-300">
            {uniqueRadiationTypes.map(type => {
              const info = getRadiationTypeInfo(type, t)
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
              {t('elements.shellDesignations')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
