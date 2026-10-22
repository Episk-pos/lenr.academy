import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getRadiationTypeInfo } from '../constants/radiationTypes'
import { X, ChevronDown, ChevronUp, ArrowRight, Radiation } from 'lucide-react'
import type { Nuclide, DecayData, DecayChainResult } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { getRadioactiveDecayData, getElementSymbolByZ, getNuclideBySymbol, getNuclideHalfLives, type NuclideHalfLife } from '../services/queryService'
import { traceDecayChain } from '../services/decayChainService'
import { useNavigate, Link } from 'react-router-dom'
import { expandHalfLifeUnit } from '../utils/formatUtils'
import { getIAEAAbundance } from '../constants/iaeaAbundances'
import DecayChainDiagram from './DecayChainDiagram'

interface NuclideDetailsCardProps {
  nuclide: Nuclide | null
  onClose?: () => void
  /** Single-column layout for narrow containers (details rail / drawer) */
  compact?: boolean
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


export default function NuclideDetailsCard({ nuclide, onClose, compact = false }: NuclideDetailsCardProps) {
  const { t } = useTranslation()
  const gridCols = compact ? 'grid-cols-1 gap-4' : 'md:grid-cols-2 lg:grid-cols-3 gap-6'
  const twoCols = compact ? 'grid-cols-1' : 'md:grid-cols-2'
  const { db } = useDatabase()
  const navigate = useNavigate()
  const [decayData, setDecayData] = useState<DecayData[]>([])
  const [groundStateHalfLife, setGroundStateHalfLife] = useState<NuclideHalfLife | null>(null)
  const [showFullDecayTable, setShowFullDecayTable] = useState(false)
  const [decayChain, setDecayChain] = useState<DecayChainResult | null>(null)
  const [showDecayChain, setShowDecayChain] = useState(false)
  const [chainDepth, setChainDepth] = useState(5)
  const [minBranchingRatio, setMinBranchingRatio] = useState(10)

  useEffect(() => {
    if (!nuclide || !db) {
      setDecayData([])
      setGroundStateHalfLife(null)
      setDecayChain(null)
      return
    }

    const data = getRadioactiveDecayData(db, nuclide.Z, nuclide.A)
    setDecayData(data)

    // Ground-state half-life: the RadioNuclides row whose LHL matches NuclidesPlus.LHL
    // (skips isomer rows such as Co-60m or Ba-137m)
    const lhl = typeof nuclide.logHalfLife === 'number' ? nuclide.logHalfLife : null
    const halfLives = getNuclideHalfLives(db, [{ Z: nuclide.Z, A: nuclide.A, logHalfLife: lhl }])
    setGroundStateHalfLife(halfLives.get(`${nuclide.Z}-${nuclide.A}`) ?? null)

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

  // Ground-state half-life in its natural units (e.g. T-3 12.33 years, Co-60
  // 5.2714 years); falls back to 10^LHL years when no RadioNuclides row matches.
  const primaryHalfLife = groundStateHalfLife && groundStateHalfLife.halfLife !== null && groundStateHalfLife.units !== null
    ? { halfLife: groundStateHalfLife.halfLife, units: groundStateHalfLife.units }
    : null
  const isStableNuclide = typeof nuclide.logHalfLife === 'number' && nuclide.logHalfLife > 9
  // Ground state actually decays (U-238, Co-60) — not merely an isomer listed under a stable Z/A (Ba-137m)
  const isRadioactive = groundStateHalfLife !== null
  // Never surface an isomer's mode (e.g. IT) as the primary decay of a stable nuclide
  const primaryDecayMode = nuclide.RDM || (!isStableNuclide ? groundStateHalfLife?.decayMode : null) || null

  const statusLabel =
    nuclide.SUS === 'SPN' ? t('elementData.status.stablePrimordial') :
    nuclide.SUS === 'SYN' ? t('elementData.status.synthetic') :
    nuclide.SUS === 'UPN' ? t('elementData.status.unstablePrimordial') :
    null

  const magneticMoment = nuclide.MD !== null && nuclide.MD !== undefined && nuclide.MD !== '' && !isNaN(Number(nuclide.MD))
    ? Number(nuclide.MD).toFixed(4)
    : null

  // Pre-compute IAEA abundance comparison for this nuclide
  const iaeaAbundance = getIAEAAbundance(nuclide.E, nuclide.A)
  const iaeaDelta = iaeaAbundance !== null && typeof nuclide.pcaNCrust === 'number'
    ? iaeaAbundance - nuclide.pcaNCrust
    : null

  return (
    <>
    <div className={`card ${compact ? 'p-4 [&_dd]:min-w-0 [&_dd]:break-words' : 'p-6'} animate-fade-in max-w-full`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
            <Link
              to={`/element-data?Z=${nuclide.Z}&A=${nuclide.A}`}
              className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
            >
              {nuclide.E}-{nuclide.A}
            </Link>
            {isRadioactive && (
              <span title={t('reactions.radioactive')}>
                <Radiation className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </span>
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('elements.atomicNumber')}: {nuclide.Z} • {t('elements.massNumber')}: {nuclide.A}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={t('elements.closeNuclideDetails')}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className={`grid ${gridCols} mb-6`}>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.nuclearProperties')}
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.element')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.E}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.protonsZ')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.Z}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.massNumberA')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.A}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.neutronsN')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.A - nuclide.Z}</dd>
            </div>
            {statusLabel && (
              <div className="flex justify-between gap-2" data-testid="nuclide-classification">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elementData.classification')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{statusLabel}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.quantumProperties')}
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <dt className="text-gray-600 dark:text-gray-400">{t('elements.nuclearType')}:</dt>
              <dd>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  nuclide.nBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                }`}>
                  {nuclide.nBorF === 'b' ? t('elements.boson') : t('elements.fermion')}
                </span>
              </dd>
            </div>
            <div className="flex justify-between items-center">
              <dt className="text-gray-600 dark:text-gray-400">{t('elements.atomicType')}:</dt>
              <dd>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  nuclide.aBorF === 'b' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                }`}>
                  {nuclide.aBorF === 'b' ? t('elements.boson') : t('elements.fermion')}
                </span>
              </dd>
            </div>
            {nuclide.SP && (
              <div className="flex justify-between gap-2" data-testid="nuclide-spin">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elementData.nuclearSpin')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{nuclide.SP}</dd>
              </div>
            )}
            {magneticMoment !== null && (
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elementData.magneticMoment')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">{magneticMoment} μₙ</dd>
              </div>
            )}
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
              {t('reactions.nuclear')}: {nuclide.nBorF === 'b' ? t('elements.evenA') : t('elements.oddA')}<br />
              {t('reactions.atomic')}: {nuclide.aBorF === 'b' ? t('elements.evenN') : t('elements.oddN')}
            </div>
          </dl>
        </div>

        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.energyAndMass')}
          </h3>
          <dl className="space-y-2 text-sm overflow-hidden">
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.bindingEnergy')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                {nuclide.BE.toFixed(3)} MeV
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.bePerNucleon')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                {(nuclide.BE / nuclide.A).toFixed(3)} MeV
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.atomicMass')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                {nuclide.AMU.toFixed(6)} amu
              </dd>
            </div>
          </dl>
        </div>

        {(typeof nuclide.pcaNCrust === 'number' || typeof nuclide.ppmNCrust === 'number' || typeof nuclide.ppmNSolar === 'number' || iaeaAbundance !== null) && (
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              {t('elements.naturalAbundance')}
            </h3>
            <dl className="space-y-2 text-sm overflow-hidden">
              {typeof nuclide.pcaNCrust === 'number' && !isNaN(nuclide.pcaNCrust) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.isotopicPercent')}:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                    {nuclide.pcaNCrust.toFixed(2)}%
                  </dd>
                </div>
              )}
              {typeof nuclide.pcaNCrust === 'number' && iaeaAbundance !== null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.isotopicPercent')} (IAEA):</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate" title={iaeaDelta !== null ? `Δ${iaeaDelta >= 0 ? '+' : ''}${iaeaDelta.toFixed(4)}` : undefined}>
                    {iaeaAbundance.toFixed(4)}%
                  </dd>
                </div>
              )}
              {typeof nuclide.pcaNCrust !== 'number' && iaeaAbundance !== null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.isotopicPercent')}:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                    {iaeaAbundance.toFixed(4)}%
                    <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">(IAEA)</span>
                  </dd>
                </div>
              )}
              {typeof nuclide.ppmNCrust === 'number' && !isNaN(nuclide.ppmNCrust) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.earthsCrust')}:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                    {nuclide.ppmNCrust >= 1000
                      ? `${(nuclide.ppmNCrust / 1000).toFixed(2)} g/kg`
                      : nuclide.ppmNCrust >= 1
                      ? `${nuclide.ppmNCrust.toFixed(2)} ppm`
                      : `${(nuclide.ppmNCrust * 1000).toFixed(2)} ppb`
                    }
                  </dd>
                </div>
              )}
              {typeof nuclide.ppmNSolar === 'number' && !isNaN(nuclide.ppmNSolar) && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.solarSystem')}:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                    {nuclide.ppmNSolar >= 1000
                      ? `${(nuclide.ppmNSolar / 1000).toFixed(2)} g/kg`
                      : nuclide.ppmNSolar >= 1
                      ? `${nuclide.ppmNSolar.toFixed(2)} ppm`
                      : `${(nuclide.ppmNSolar * 1000).toFixed(2)} ppb`
                    }
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
              {t('elements.isotopicRelative', { element: nuclide.E })}
            </div>
          </div>
        )}

        {typeof nuclide.logHalfLife === 'number' && !isNaN(nuclide.logHalfLife) && (
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              {t('elements.stability')}
            </h3>
            <dl className="space-y-2 text-sm overflow-hidden">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.logHalfLifeYears')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">
                  {t('elements.valueYears', { value: nuclide.logHalfLife.toFixed(2) })}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elements.halfLife')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate" data-testid="nuclide-half-life">
                  {primaryHalfLife
                    ? `${primaryHalfLife.halfLife >= 10000 ? primaryHalfLife.halfLife.toExponential(2) : primaryHalfLife.halfLife} ${expandHalfLifeUnit(primaryHalfLife.units)}`
                    : t('elements.valueYears', { value: Math.pow(10, nuclide.logHalfLife).toExponential(2) })}
                </dd>
              </div>
              {primaryDecayMode && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elementData.primaryDecay')}:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">{primaryDecayMode}</dd>
                </div>
              )}
              {typeof nuclide.DEMeV === 'number' && nuclide.DEMeV > 0 && (
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-600 dark:text-gray-400 flex-shrink-0">{t('elementData.decayEnergy')}:</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100 text-right truncate">{nuclide.DEMeV.toFixed(4)} MeV</dd>
                </div>
              )}
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-300 break-words">
                {nuclide.logHalfLife > 9 ? t('elements.stableOrLongLived') :
                 nuclide.logHalfLife > 0 ? t('elements.radioactiveDecay') :
                 t('elements.shortLivedRadioactive')}
              </div>
            </dl>
          </div>
        )}
      </div>

      {/* Sections shown inside card on xs+ screens, outside on <xs */}
      <div className="hidden xs:block">
      {/* Radioactive Decay Table */}
      {decayData.length > 0 && (
        <div className="mt-4 xs:mt-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.radioactiveDecay')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 dark:border-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="pl-3 pr-2 sm:pl-6 sm:pr-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.decayMode')}</th>
                      <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.radiationType')}</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{t('reactions.energyMeV')}</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{t('elements.intensityPercent')}</th>
                      <th className="pl-2 pr-3 sm:pl-3 sm:pr-6 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.halfLife')}</th>
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
                              {decayData.length - 4 !== 1
                                ? t('elements.hideDecayModesPlural', { count: decayData.length - 4 })
                                : t('elements.hideDecayModes', { count: decayData.length - 4 })}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              {decayData.length - 4 !== 1
                                ? t('elements.showDecayModesPlural', { count: decayData.length - 4 })
                                : t('elements.showDecayModes', { count: decayData.length - 4 })}
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

      {/* Decay Chain Visualization */}
      {decayChain && decayChain.totalGenerations > 0 && (
        <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
              {t('elements.decayChainVisualization')}
            </h3>
            <button
              onClick={() => setShowDecayChain(!showDecayChain)}
              className="btn btn-secondary p-2"
              title={showDecayChain ? t('elements.collapseDecayChain') : t('elements.expandDecayChain')}
              aria-label={showDecayChain ? t('elements.collapseDecayChain') : t('elements.expandDecayChain')}
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showDecayChain ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showDecayChain ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* Controls */}
            <div className={`grid ${twoCols} gap-4 mb-4`}>
              <div>
                <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                  {t('elements.maxDepthGenerations', { depth: chainDepth })}
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
                  {t('elements.minBranchingRatio', { ratio: minBranchingRatio })}
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
              <div><strong>{t('elements.totalGenerations')}:</strong> {decayChain.totalGenerations}</div>
              <div><strong>{t('elements.branchCount')}:</strong> {decayChain.branchCount}</div>
              <div>
                <strong>{t('elements.terminalNuclides')}:</strong> {decayChain.terminalNuclides.map(n => `${n.E}-${n.A}`).join(', ')}
                {' '}
                ({decayChain.terminalNuclides.filter(n => n.isStable).length} {t('elements.stableCount')},{' '}
                {decayChain.terminalNuclides.filter(n => !n.isStable).length} {t('elements.radioactiveCount')})
              </div>
            </div>

            {/* Diagram */}
            <DecayChainDiagram root={decayChain.root} maxHeight={300} />
          </div>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 text-sm">
          {t('elements.aboutBosonFermion')}
        </h3>
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          <strong>{t('reactions.nuclear')}:</strong> {t('elements.bosonFermionNuclear')}<br />
          <strong>{t('reactions.atomic')}:</strong> {t('elements.bosonFermionAtomic')}<br />
          {t('elements.bosonFermionQuantum')}
        </p>
      </div>

      {decayData.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">
            {t('elements.radiationTypeLegend')}
          </h3>
          <div className={`grid ${twoCols} gap-x-4 gap-y-1 text-xs text-amber-800 dark:text-amber-300`}>
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
            <div className={`${compact ? '' : 'md:col-span-2 '}mt-1 text-xs opacity-80`}>
              {t('elements.shellDesignations')}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>

    {/* Sections shown outside card on <xs screens only */}
    <div className="block xs:hidden">
      {/* Radioactive Decay Table */}
      {decayData.length > 0 && (
        <div className="mt-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.radioactiveDecay')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 dark:border-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="pl-3 pr-2 sm:pl-6 sm:pr-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.decayMode')}</th>
                      <th className="px-2 sm:px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.radiationType')}</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{t('reactions.energyMeV')}</th>
                      <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-700 dark:text-gray-300">{t('elements.intensityPercent')}</th>
                      <th className="pl-2 pr-3 sm:pl-3 sm:pr-6 py-2 text-left font-medium text-gray-700 dark:text-gray-300">{t('elements.halfLife')}</th>
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
                              {decayData.length - 4 !== 1
                                ? t('elements.hideDecayModesPlural', { count: decayData.length - 4 })
                                : t('elements.hideDecayModes', { count: decayData.length - 4 })}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" />
                              {decayData.length - 4 !== 1
                                ? t('elements.showDecayModesPlural', { count: decayData.length - 4 })
                                : t('elements.showDecayModes', { count: decayData.length - 4 })}
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

      {/* Decay Chain Visualization */}
      {decayChain && decayChain.totalGenerations > 0 && (
        <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
              {t('elements.decayChainVisualization')}
            </h3>
            <button
              onClick={() => setShowDecayChain(!showDecayChain)}
              className="btn btn-secondary p-2"
              title={showDecayChain ? t('elements.collapseDecayChain') : t('elements.expandDecayChain')}
              aria-label={showDecayChain ? t('elements.collapseDecayChain') : t('elements.expandDecayChain')}
            >
              <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${showDecayChain ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showDecayChain ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            {/* Controls */}
            <div className={`grid ${twoCols} gap-4 mb-4`}>
              <div>
                <label className="block text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">
                  {t('elements.maxDepthGenerations', { depth: chainDepth })}
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
                  {t('elements.minBranchingRatio', { ratio: minBranchingRatio })}
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
              <div><strong>{t('elements.totalGenerations')}:</strong> {decayChain.totalGenerations}</div>
              <div><strong>{t('elements.branchCount')}:</strong> {decayChain.branchCount}</div>
              <div>
                <strong>{t('elements.terminalNuclides')}:</strong> {decayChain.terminalNuclides.map(n => `${n.E}-${n.A}`).join(', ')}
                {' '}
                ({decayChain.terminalNuclides.filter(n => n.isStable).length} {t('elements.stableCount')},{' '}
                {decayChain.terminalNuclides.filter(n => !n.isStable).length} {t('elements.radioactiveCount')})
              </div>
            </div>

            {/* Diagram */}
            <DecayChainDiagram root={decayChain.root} maxHeight={300} />
          </div>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 text-sm">
          {t('elements.aboutBosonFermion')}
        </h3>
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          <strong>{t('reactions.nuclear')}:</strong> {t('elements.bosonFermionNuclear')}<br />
          <strong>{t('reactions.atomic')}:</strong> {t('elements.bosonFermionAtomic')}<br />
          {t('elements.bosonFermionQuantum')}
        </p>
      </div>

      {decayData.length > 0 && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">
            {t('elements.radiationTypeLegend')}
          </h3>
          <div className={`grid ${twoCols} gap-x-4 gap-y-1 text-xs text-amber-800 dark:text-amber-300`}>
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
            <div className={`${compact ? '' : 'md:col-span-2 '}mt-1 text-xs opacity-80`}>
              {t('elements.shellDesignations')}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
