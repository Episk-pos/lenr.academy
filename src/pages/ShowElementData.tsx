import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Radiation, ChevronDown, ExternalLink } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useTheme } from '../contexts/ThemeContext'
import { useLayout } from '../contexts/LayoutContext'
import type { Element, Nuclide, AtomicRadiiData, RadioactiveNuclideData, DisplayNuclide, RadioNuclideListItem } from '../types'
import PeriodicTable from '../components/PeriodicTable'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import CitationBadge from '../components/CitationBadge'
import { getCitationsForElement } from '../services/citationsService'
import ParticleDetailsCard from '../components/ParticleDetailsCard'
import RadioactiveNuclideCard from '../components/RadioactiveNuclideCard'
import TabNavigation, { Tab } from '../components/TabNavigation'
import SortableTable, { TableColumn } from '../components/SortableTable'
import FilterPanel, { FilterConfig, FilterPreset } from '../components/FilterPanel'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import Tooltip from '../components/Tooltip'
import IsotopeCard from '../components/IsotopeCard'
import DecayChainDiagram from '../components/DecayChainDiagram'
import SegreChartDiagram, { type ChartNuclide } from '../components/SegreChartDiagram'
import ColumnToggle from '../components/ColumnToggle'
import { useColumnVisibility } from '../hooks/useColumnVisibility'
import {
  getAllNuclidesByElement,
  getAtomicRadii,
  getAllElements,
  getAllNuclides,
  getAllDecays,
  getRadioactiveNuclides,
  getNuclideBySymbol,
  getRadioactiveNuclideData,
  getNuclideHalfLives,
  getUniqueDecayModes,
  getUniqueRadiationTypes,
  type RadioactiveDecay
} from '../services/queryService'
import { traceDecayChain } from '../services/decayChainService'
import RussellChartDiagram from '../components/RussellChartDiagram'
import RussellWaveDiagram from '../components/RussellWaveDiagram'
import RussellChart3D from '../components/RussellChart3D'
import { RUSSELL_COLORS, getPredictedElements } from '../constants/russellElements'
import { expandHalfLifeUnit, normalizeElementSymbol, formatDensity, formatSpecificHeat, densityToGPerCm3 } from '../utils/formatUtils'
import { filterDataBySearch, SearchMetadata } from '../utils/searchUtils'
import { getRadiationTypeInfo, localizeRadiationTypeInfo } from '../constants/radiationTypes'
import { SPECIAL_PARTICLE_IDS, SPECIAL_PARTICLES_BY_ID } from '../constants/specialParticles'
import PageHeader from '../components/PageHeader'
import { PAGE_ICONS } from '../constants/pageIcons'

// Comprehensive decay mode information. name/description are the English source
// strings; the UI translates them via the decayModes.<code>.name|description keys.
const DECAY_MODE_INFO: Record<string, { name: string; description: string; url: string }> = {
  'A': { name: 'Alpha decay', description: 'emission of an alpha particle (2 protons + 2 neutrons)', url: 'https://en.wikipedia.org/wiki/Alpha_decay' },
  'B-': { name: 'Beta minus decay', description: 'neutron converts to proton, electron, and antineutrino', url: 'https://en.wikipedia.org/wiki/Beta_decay' },
  'B+': { name: 'Beta plus decay', description: 'proton converts to neutron, positron, and neutrino', url: 'https://en.wikipedia.org/wiki/Positron_emission' },
  'EC': { name: 'Electron capture', description: 'proton captures inner orbital electron, becomes neutron', url: 'https://en.wikipedia.org/wiki/Electron_capture' },
  'IT': { name: 'Isomeric transition', description: 'excited nucleus releases energy without changing composition', url: 'https://en.wikipedia.org/wiki/Isomeric_transition' },
  'SF': { name: 'Spontaneous fission', description: 'nucleus splits into lighter nuclei', url: 'https://en.wikipedia.org/wiki/Spontaneous_fission' },
  'N': { name: 'Neutron emission', description: 'nucleus emits one or more neutrons', url: 'https://en.wikipedia.org/wiki/Neutron_emission' },
  'P': { name: 'Proton emission', description: 'nucleus emits a proton', url: 'https://en.wikipedia.org/wiki/Proton_emission' },
  '2N': { name: 'Double neutron emission', description: 'nucleus emits two neutrons', url: 'https://en.wikipedia.org/wiki/Neutron_emission' },
  '2P': { name: 'Double proton emission', description: 'nucleus emits two protons', url: 'https://en.wikipedia.org/wiki/Proton_emission' }
}

// Helper function to get decay mode tooltip content
function getDecayModeTooltip(mode: string, t: TFunction): JSX.Element {
  const info = DECAY_MODE_INFO[mode]
  if (info) {
    return (
      <div>
        <div className="font-semibold mb-1">{mode}: {t(`decayModes.${mode}.name`, { defaultValue: info.name })}</div>
        <div className="mb-2">{t(`decayModes.${mode}.description`, { defaultValue: info.description })}</div>
        <a
          href={info.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300 hover:text-blue-200 underline text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {t('elements.learnMore')}
        </a>
      </div>
    )
  }
  return <div>{t('elements.decayModeDescription', { mode })}</div>
}

// Helper function to get radiation type tooltip content
function getRadiationTypeTooltip(type: string, t: TFunction): JSX.Element {
  const info = getRadiationTypeInfo(type, t)
  if (info) {
    return (
      <div>
        <div className="font-semibold mb-1">{type}: {info.name}</div>
        <div className="mb-2">{info.description}</div>
        <a
          href={info.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300 hover:text-blue-200 underline text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {t('elements.learnMore')}
        </a>
        {(type.includes('K') || type.includes('L') || type.includes('M') || type.includes('N')) && (
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs opacity-80">
            {t('elements.shellDesignations')}
          </div>
        )}
      </div>
    )
  }
  return <div>{t('elements.radiation', { type })}</div>
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

/** Atomic radii legend entries: [label i18n key, description i18n key] */
const ATOMIC_RADII_LEGEND = [
  ['elements.empirical', 'elementData.radiiMeasured'],
  ['elements.calculated', 'elementData.radiiTheoretical'],
  ['elements.vanDerWaals', 'elementData.radiiNonBonded'],
  ['elements.covalent', 'elementData.radiiBonded'],
] as const

/**
 * Compact half-life label for isotope cards, e.g. "12.33Y" or "4.5e+9Y".
 */
function formatCompactHalfLife(halfLife: number | null, units: string | null): string | null {
  if (halfLife === null || units === null) return null
  return halfLife >= 10000 ? `${halfLife.toExponential(1)}${units}` : `${halfLife}${units}`
}

export default function ShowElementData() {
  const { t } = useTranslation()
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
  const { theme } = useTheme()
  const { openSidebar, setMobileHeaderHidden } = useLayout()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab state
  const activeTabParam = searchParams.get('tab') || 'integrated'
  const [activeTab, setActiveTab] = useState(activeTabParam)
  const [isTabsStuck, setIsTabsStuck] = useState(false)

  // Update mobile header visibility when tabs stick
  const handleTabsStuckChange = (stuck: boolean) => {
    setIsTabsStuck(stuck)
    setMobileHeaderHidden(stuck)
  }

  // Reset mobile header when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      setMobileHeaderHidden(false)
    }
  }, [setMobileHeaderHidden])

  // Integrated tab state
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [selectedParticle, setSelectedParticle] = useState<string | null>(null)
  const [isotopes, setIsotopes] = useState<DisplayNuclide[]>([])
  const [selectedNuclide, setSelectedNuclide] = useState<Nuclide | null>(null)
  const [atomicRadii, setAtomicRadii] = useState<AtomicRadiiData | null>(null)
  const [requestedMissingNuclide, setRequestedMissingNuclide] = useState<{ E: string; A: number } | null>(null)
  const [radioactiveNuclideData, setRadioactiveNuclideData] = useState<RadioactiveNuclideData | null>(null)
  const [showLimitedDataNuclides, setShowLimitedDataNuclides] = useState(false) // Only show full NuclidesPlus data by default

  // Pagination state (URL-based)

  // Filter state (URL-stateful)
  const [elementsFilters, setElementsFilters] = useState<Record<string, any>>({})
  const [nuclidesFilters, setNuclidesFilters] = useState<Record<string, any>>({})
  const [decaysFilters, setDecaysFilters] = useState<Record<string, any>>({})

  // Collapse state (per tab, session-only)
  const [elementsCollapsed, setElementsCollapsed] = useState(true)
  const [nuclidesCollapsed, setNuclidesCollapsed] = useState(true)
  const [decaysCollapsed, setDecaysCollapsed] = useState(true)
  const [segreExpanded, setSegreExpanded] = useState(false)

  // Search state (per tab, transient - not in URL)
  const [elementsSearch, setElementsSearch] = useState('')
  const [nuclidesSearch, setNuclidesSearch] = useState('')
  const [decaysSearch, setDecaysSearch] = useState('')

  // Custom presets (stored in localStorage)
  const [customElementsPresets, setCustomElementsPresets] = useState<FilterPreset[]>([])
  const [customNuclidesPresets, setCustomNuclidesPresets] = useState<FilterPreset[]>([])
  const [customDecaysPresets, setCustomDecaysPresets] = useState<FilterPreset[]>([])

  // Russell tab: grid vs wave vs 3D view toggle
  const [russellView, setRussellView] = useState<'grid' | 'wave' | '3d'>('grid')

  // Expanded row state (per tab, session-only - NOT in URL)
  const [elementsExpandedRows, setElementsExpandedRows] = useState<Set<string | number>>(new Set())
  const [nuclidesExpandedRows, setNuclidesExpandedRows] = useState<Set<string | number>>(new Set())
  const [decaysExpandedRows, setDecaysExpandedRows] = useState<Set<string | number>>(new Set())

  // Handler for decays table to ensure only one row is expanded at a time
  const handleDecaysExpandedRowsChange = (newExpandedRows: Set<string | number>) => {
    // If expanding a row, only keep the newly expanded one
    if (newExpandedRows.size > decaysExpandedRows.size) {
      // Find the newly added row key
      const newKey = Array.from(newExpandedRows).find(key => !decaysExpandedRows.has(key))
      if (newKey !== undefined) {
        setDecaysExpandedRows(new Set([newKey]))
      }
    } else {
      // If collapsing, use the new set as-is
      setDecaysExpandedRows(newExpandedRows)
    }
  }

  // Get all elements from database (memoized to prevent recreating on every render)
  const allElements: Element[] = useMemo(() => {
    if (!db) return []
    return getAllElements(db)
  }, [db])

  // Create element info array for enhanced searching (memoized)
  const elementInfoArray = useMemo(() => {
    return allElements.map(el => ({
      symbol: el.E,
      name: el.EName,
      Z: el.Z
    }))
  }, [allElements])

  // Get all nuclides from database (memoized)
  const allNuclides: Nuclide[] = useMemo(() => {
    if (!db) return []
    return getAllNuclides(db)
  }, [db])

  // Segre Chart nuclides (derived from allNuclides)
  const chartNuclides: ChartNuclide[] = useMemo(() => {
    return allNuclides.map(n => ({
      Z: n.Z,
      N: n.A - n.Z,
      A: n.A,
      E: n.E,
      stability: (n.logHalfLife === undefined || n.logHalfLife === null) ? 'unknown' as const
        : n.logHalfLife > 9 ? 'stable' as const
        : n.logHalfLife > 2 ? 'long' as const
        : 'short' as const,
      logHalfLife: n.logHalfLife,
    }))
  }, [allNuclides])

  // Get all decays (memoized)
  const allDecays = useMemo(() => {
    if (!db) return []
    // Fetch ALL decays without pagination (pagination will be done client-side)
    const result = getAllDecays(db, {
      limit: 999999, // Get all records
      offset: 0,
      sortBy: 'Z',
      sortDirection: 'asc'
    })
    return result.decays
  }, [db])

  // Get radioactive nuclides for batch checking (memoized)
  const radioactiveNuclides = useMemo(() => {
    if (!db || allNuclides.length === 0) return new Set<string>()
    return getRadioactiveNuclides(db, allNuclides)
  }, [db, allNuclides])

  const normalizedSelectedElement = selectedElement ? normalizeElementSymbol(selectedElement) : null
  const element = normalizedSelectedElement
    ? allElements.find(el => el.E === normalizedSelectedElement)
    : undefined

  const selectedParticleInfo = selectedParticle ? SPECIAL_PARTICLES_BY_ID[selectedParticle] : undefined

  const selectedParticleNuclide = useMemo(() => {
    if (!db || !selectedParticleInfo) return null
    return getNuclideBySymbol(db, selectedParticleInfo.id, selectedParticleInfo.massNumber)
  }, [db, selectedParticleInfo])

  // Apply filters to data (memoized)
  const filteredElements = useMemo(() => {
    let result = allElements

    // Period filter
    if (elementsFilters.period) {
      result = result.filter(el => el.Period === Number(elementsFilters.period))
    }

    // Group filter
    if (elementsFilters.group) {
      result = result.filter(el => el.Group === Number(elementsFilters.group))
    }

    // Magnetic type filter
    if (elementsFilters.magType) {
      result = result.filter(el => el.MagType === elementsFilters.magType)
    }

    // Atomic weight range
    if (elementsFilters.atomicWeight?.min != null) {
      result = result.filter(el => el.AWeight != null && el.AWeight >= elementsFilters.atomicWeight.min)
    }
    if (elementsFilters.atomicWeight?.max != null) {
      result = result.filter(el => el.AWeight != null && el.AWeight <= elementsFilters.atomicWeight.max)
    }

    // Melting point range
    if (elementsFilters.melting?.min != null) {
      result = result.filter(el => el.Melting != null && el.Melting >= elementsFilters.melting.min)
    }
    if (elementsFilters.melting?.max != null) {
      result = result.filter(el => el.Melting != null && el.Melting <= elementsFilters.melting.max)
    }

    // Boiling point range
    if (elementsFilters.boiling?.min != null) {
      result = result.filter(el => el.Boiling != null && el.Boiling >= elementsFilters.boiling.min)
    }
    if (elementsFilters.boiling?.max != null) {
      result = result.filter(el => el.Boiling != null && el.Boiling <= elementsFilters.boiling.max)
    }

    // Density range
    if (elementsFilters.density?.min != null) {
      result = result.filter(el => el.STPDensity != null && densityToGPerCm3(el.STPDensity) >= elementsFilters.density.min)
    }
    if (elementsFilters.density?.max != null) {
      result = result.filter(el => el.STPDensity != null && densityToGPerCm3(el.STPDensity) <= elementsFilters.density.max)
    }

    // Apply search filter (after other filters, before pagination)
    if (elementsSearch) {
      const columns = [
        { key: 'Z' },
        { key: 'E' },
        { key: 'EName' },
        { key: 'Period' },
        { key: 'Group' },
        { key: 'AWeight' }
      ]
      result = filterDataBySearch(result, columns, elementsSearch)
    }

    return result
  }, [allElements, elementsFilters, elementsSearch])

  const filteredNuclides = useMemo(() => {
    let result = allNuclides

    // Element filter (multi-select)
    if (nuclidesFilters.element && nuclidesFilters.element.length > 0) {
      result = result.filter(n => nuclidesFilters.element.includes(n.E))
    }

    // Z range
    if (nuclidesFilters.zRange?.min != null) {
      result = result.filter(n => n.Z >= nuclidesFilters.zRange.min)
    }
    if (nuclidesFilters.zRange?.max != null) {
      result = result.filter(n => n.Z <= nuclidesFilters.zRange.max)
    }

    // A range
    if (nuclidesFilters.aRange?.min != null) {
      result = result.filter(n => n.A >= nuclidesFilters.aRange.min)
    }
    if (nuclidesFilters.aRange?.max != null) {
      result = result.filter(n => n.A <= nuclidesFilters.aRange.max)
    }

    // Binding energy range
    if (nuclidesFilters.bindingEnergy?.min != null) {
      result = result.filter(n => n.BE != null && n.BE >= nuclidesFilters.bindingEnergy.min)
    }
    if (nuclidesFilters.bindingEnergy?.max != null) {
      result = result.filter(n => n.BE != null && n.BE <= nuclidesFilters.bindingEnergy.max)
    }

    // Nuclear boson/fermion
    if (nuclidesFilters.nBorF) {
      result = result.filter(n => n.nBorF === nuclidesFilters.nBorF)
    }

    // Atomic boson/fermion
    if (nuclidesFilters.aBorF) {
      result = result.filter(n => n.aBorF === nuclidesFilters.aBorF)
    }

    // Stability filters
    if (nuclidesFilters.onlyStable) {
      result = result.filter(n => typeof n.logHalfLife === 'number' && n.logHalfLife > 9)
    }

    if (nuclidesFilters.onlyRadioactive) {
      result = result.filter(n => radioactiveNuclides.has(`${n.Z}-${n.A}`))
    }

    // Apply search filter (after other filters, before pagination)
    if (nuclidesSearch) {
      const columns = [
        { key: 'E' },
        { key: 'Z' },
        { key: 'A' },
        { key: 'BE' },
        { key: 'nBorF' },
        { key: 'aBorF' }
      ]
      const searchMetadata: SearchMetadata = {
        elements: elementInfoArray
      }
      result = filterDataBySearch(result, columns, nuclidesSearch, searchMetadata)
    }

    return result
  }, [allNuclides, nuclidesFilters, radioactiveNuclides, nuclidesSearch, elementInfoArray])

  const filteredDecays = useMemo(() => {
    let result = allDecays

    // Element filter (multi-select)
    if (decaysFilters.element && decaysFilters.element.length > 0) {
      result = result.filter(d => decaysFilters.element.includes(d.E))
    }

    // Decay mode filter (multi-select)
    if (decaysFilters.decayMode && decaysFilters.decayMode.length > 0) {
      result = result.filter(d => decaysFilters.decayMode.includes(d.RDM))
    }

    // Radiation type filter (multi-select)
    if (decaysFilters.radiationType && decaysFilters.radiationType.length > 0) {
      result = result.filter(d => decaysFilters.radiationType.includes(d.RT))
    }

    // Energy range
    if (decaysFilters.energy?.min != null) {
      result = result.filter(d => d.DEKeV != null && d.DEKeV >= decaysFilters.energy.min)
    }
    if (decaysFilters.energy?.max != null) {
      result = result.filter(d => d.DEKeV != null && d.DEKeV <= decaysFilters.energy.max)
    }

    // Intensity range
    if (decaysFilters.intensity?.min != null) {
      result = result.filter(d => d.RI != null && d.RI >= decaysFilters.intensity.min)
    }
    if (decaysFilters.intensity?.max != null) {
      result = result.filter(d => d.RI != null && d.RI <= decaysFilters.intensity.max)
    }

    // Apply search filter (after other filters, before pagination)
    if (decaysSearch) {
      const columns = [
        { key: 'E' },
        { key: 'Z' },
        { key: 'A' },
        { key: 'RDM' },
        { key: 'RT' },
        { key: 'DEKeV' },
        { key: 'RI' }
      ]
      const searchMetadata: SearchMetadata = {
        elements: elementInfoArray,
        daughterNuclideGetter: (row: RadioactiveDecay) => {
          return getDaughterNuclide(row.Z, row.A, row.E, row.RDM || '')
        }
      }
      result = filterDataBySearch(result, columns, decaysSearch, searchMetadata)
    }

    return result
  }, [allDecays, decaysFilters, decaysSearch, elementInfoArray])

  // Filter handlers
  const handleElementsFilterChange = (key: string, value: any) => {
    const newFilters = { ...elementsFilters, [key]: value }
    setElementsFilters(newFilters)

    // Update URL
    const newParams = new URLSearchParams(searchParams)
    if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      newParams.set(`ef_${key}`, JSON.stringify(value))
    } else {
      newParams.delete(`ef_${key}`)
    }
    setSearchParams(newParams)
  }

  const handleNuclidesFilterChange = (key: string, value: any) => {
    const newFilters = { ...nuclidesFilters, [key]: value }
    setNuclidesFilters(newFilters)

    // Update URL
    const newParams = new URLSearchParams(searchParams)
    if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      newParams.set(`nf_${key}`, JSON.stringify(value))
    } else {
      newParams.delete(`nf_${key}`)
    }
    setSearchParams(newParams)
  }

  const handleDecaysFilterChange = (key: string, value: any) => {
    const newFilters = { ...decaysFilters, [key]: value }
    setDecaysFilters(newFilters)

    // Update URL
    const newParams = new URLSearchParams(searchParams)
    if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      newParams.set(`df_${key}`, JSON.stringify(value))
    } else {
      newParams.delete(`df_${key}`)
    }
    setSearchParams(newParams)
  }

  const handleElementsClearFilters = () => {
    setElementsFilters({})
    const newParams = new URLSearchParams(searchParams)
    // Remove all elements filter params
    Array.from(newParams.keys())
      .filter(k => k.startsWith('ef_'))
      .forEach(k => newParams.delete(k))
    setSearchParams(newParams)
  }

  const handleNuclidesClearFilters = () => {
    setNuclidesFilters({})
    const newParams = new URLSearchParams(searchParams)
    // Remove all nuclides filter params
    Array.from(newParams.keys())
      .filter(k => k.startsWith('nf_'))
      .forEach(k => newParams.delete(k))
    setSearchParams(newParams)
  }

  const handleDecaysClearFilters = () => {
    setDecaysFilters({})
    const newParams = new URLSearchParams(searchParams)
    // Remove all decays filter params
    Array.from(newParams.keys())
      .filter(k => k.startsWith('df_'))
      .forEach(k => newParams.delete(k))
    setSearchParams(newParams)
  }

  // Apply preset handlers (atomic filter replacement)
  const handleElementsApplyPreset = (presetFilters: Record<string, any>) => {
    setElementsFilters(presetFilters)
    const newParams = new URLSearchParams(searchParams)
    // Remove all existing filter params
    Array.from(newParams.keys())
      .filter(k => k.startsWith('ef_'))
      .forEach(k => newParams.delete(k))
    // Add new preset filter params
    Object.entries(presetFilters).forEach(([key, value]) => {
      newParams.set(`ef_${key}`, JSON.stringify(value))
    })
    setSearchParams(newParams)
  }

  const handleNuclidesApplyPreset = (presetFilters: Record<string, any>) => {
    setNuclidesFilters(presetFilters)
    const newParams = new URLSearchParams(searchParams)
    // Remove all existing filter params
    Array.from(newParams.keys())
      .filter(k => k.startsWith('nf_'))
      .forEach(k => newParams.delete(k))
    // Add new preset filter params
    Object.entries(presetFilters).forEach(([key, value]) => {
      newParams.set(`nf_${key}`, JSON.stringify(value))
    })
    setSearchParams(newParams)
  }

  const handleDecaysApplyPreset = (presetFilters: Record<string, any>) => {
    setDecaysFilters(presetFilters)
    const newParams = new URLSearchParams(searchParams)
    // Remove all existing filter params
    Array.from(newParams.keys())
      .filter(k => k.startsWith('df_'))
      .forEach(k => newParams.delete(k))
    // Add new preset filter params
    Object.entries(presetFilters).forEach(([key, value]) => {
      newParams.set(`df_${key}`, JSON.stringify(value))
    })
    setSearchParams(newParams)
  }

  // Collapse toggle handlers
  const handleElementsToggleCollapsed = () => {
    const newState = !elementsCollapsed
    setElementsCollapsed(newState)
    sessionStorage.setItem('lenr-filters-expanded-elements', String(!newState))
  }

  const handleNuclidesToggleCollapsed = () => {
    const newState = !nuclidesCollapsed
    setNuclidesCollapsed(newState)
    sessionStorage.setItem('lenr-filters-expanded-nuclides', String(!newState))
  }

  const handleDecaysToggleCollapsed = () => {
    const newState = !decaysCollapsed
    setDecaysCollapsed(newState)
    sessionStorage.setItem('lenr-filters-expanded-decays', String(!newState))
  }

  // Custom preset handlers
  const handleElementsSavePreset = (name: string, filters: Record<string, any>) => {
    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      label: name,
      filters,
      isCustom: true
    }
    const updatedPresets = [...customElementsPresets, newPreset]
    setCustomElementsPresets(updatedPresets)
    localStorage.setItem('lenr-filter-presets-elements', JSON.stringify(updatedPresets))
  }

  const handleElementsDeletePreset = (presetId: string) => {
    const updatedPresets = customElementsPresets.filter(p => p.id !== presetId)
    setCustomElementsPresets(updatedPresets)
    localStorage.setItem('lenr-filter-presets-elements', JSON.stringify(updatedPresets))
  }

  const handleNuclidesSavePreset = (name: string, filters: Record<string, any>) => {
    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      label: name,
      filters,
      isCustom: true
    }
    const updatedPresets = [...customNuclidesPresets, newPreset]
    setCustomNuclidesPresets(updatedPresets)
    localStorage.setItem('lenr-filter-presets-nuclides', JSON.stringify(updatedPresets))
  }

  const handleNuclidesDeletePreset = (presetId: string) => {
    const updatedPresets = customNuclidesPresets.filter(p => p.id !== presetId)
    setCustomNuclidesPresets(updatedPresets)
    localStorage.setItem('lenr-filter-presets-nuclides', JSON.stringify(updatedPresets))
  }

  const handleDecaysSavePreset = (name: string, filters: Record<string, any>) => {
    const newPreset: FilterPreset = {
      id: `custom-${Date.now()}`,
      label: name,
      filters,
      isCustom: true
    }
    const updatedPresets = [...customDecaysPresets, newPreset]
    setCustomDecaysPresets(updatedPresets)
    localStorage.setItem('lenr-filter-presets-decays', JSON.stringify(updatedPresets))
  }

  const handleDecaysDeletePreset = (presetId: string) => {
    const updatedPresets = customDecaysPresets.filter(p => p.id !== presetId)
    setCustomDecaysPresets(updatedPresets)
    localStorage.setItem('lenr-filter-presets-decays', JSON.stringify(updatedPresets))
  }

  // Export handlers
  const handleElementsExport = () => {
    const headers = elementsColumnVis.visibleColumns.map(col => col.label)
    const rows = filteredElements.map(row =>
      elementsColumnVis.visibleColumns.map(col => {
        const value = row[col.key as keyof Element]
        const str = value == null ? '' : String(value)
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      })
    )
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `elements_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleNuclidesExport = () => {
    const headers = nuclidesColumnVis.visibleColumns.map(col => col.label)
    const rows = filteredNuclides.map(row =>
      nuclidesColumnVis.visibleColumns.map(col => {
        const value = row[col.key as keyof Nuclide]
        const str = value == null ? '' : String(value)
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      })
    )
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nuclides_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleDecaysExport = () => {
    const headers = decaysColumnVis.visibleColumns.map(col => col.label)
    const rows = filteredDecays.map(row =>
      decaysColumnVis.visibleColumns.map(col => {
        const value = row[col.key as keyof RadioactiveDecay]
        const str = value == null ? '' : String(value)
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      })
    )
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `decays_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Define tabs with counts (showing filtered counts)
  const tabs: Tab[] = [
    { id: 'integrated', label: t('elements.integrated') },
    { id: 'russell', label: t('elements.russellChart') },
    { id: 'elements', label: t('elements.element'), count: filteredElements.length },
    { id: 'nuclides', label: t('elements.nuclides'), count: filteredNuclides.length },
    { id: 'decays', label: t('elements.decays'), count: filteredDecays.length }
  ]

  // Initialize from URL params on mount
  useEffect(() => {
    if (!db || allElements.length === 0) return

    const particleParam = searchParams.get('particle')
    const isValidParticle = particleParam && SPECIAL_PARTICLE_IDS.includes(particleParam as any)

    if (isValidParticle) {
      if (selectedParticle !== particleParam) {
        setSelectedParticle(particleParam as string)
      }
      if (selectedElement !== null) {
        setSelectedElement(null)
      }
      setSelectedNuclide(null)
      setRadioactiveNuclideData(null)
      setRequestedMissingNuclide(null)

      const newParams = new URLSearchParams(searchParams)
      let mutated = false
      if (newParams.has('Z')) {
        newParams.delete('Z')
        mutated = true
      }
      if (newParams.has('A')) {
        newParams.delete('A')
        mutated = true
      }
      if (newParams.has('iso')) {
        newParams.delete('iso')
        mutated = true
      }
      if (mutated) {
        setSearchParams(newParams, { replace: true })
      }
      return
    }

    if (particleParam && !isValidParticle) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('particle')
      setSearchParams(newParams, { replace: true })
    } else if (!particleParam && selectedParticle !== null) {
      setSelectedParticle(null)
    }

    const zParam = searchParams.get('Z')
    const isoParam = searchParams.get('iso')
    const validIso = isoParam === 'D' || isoParam === 'T'

    if (validIso) {
      if (selectedParticle !== null) {
        setSelectedParticle(null)
      }
      setSelectedElement(isoParam)
      if (zParam !== '1') {
        const newParams = new URLSearchParams(searchParams)
        newParams.set('Z', '1')
        setSearchParams(newParams, { replace: true })
      }
      return
    } else if (isoParam && !validIso) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('iso')
      setSearchParams(newParams, { replace: true })
    }

    const aParam = searchParams.get('A')

    // Validate atomic number exists
    const validElement = zParam && allElements.find(el => el.Z === parseInt(zParam))

    if (validElement) {
      if (selectedParticle !== null) {
        setSelectedParticle(null)
      }
      setSelectedElement(validElement.E)

      // If mass number param exists, we'll validate it after isotopes are loaded
      if (aParam) {
        const massNumber = parseInt(aParam)
        if (!isNaN(massNumber)) {
          // Will be validated in the isotopes effect below
        }
      }
    } else if (activeTab === 'integrated') {
      // Default to H (Z=1) if no valid element in URL and on integrated tab
      if (selectedParticle !== null) {
        setSelectedParticle(null)
      }
      setSelectedElement('H')
      const newParams = new URLSearchParams(searchParams)
      newParams.set('Z', '1')
      newParams.delete('iso')
      newParams.delete('A')
      newParams.delete('particle')
      setSearchParams(newParams, { replace: true })
    }
  }, [db, allElements, searchParams, setSearchParams, activeTab, selectedParticle, selectedElement])

  // Fetch isotopes and atomic radii when element changes and check for isotope in URL
  useEffect(() => {
    if (db && normalizedSelectedElement) {
      const currentElement = allElements.find(el => el.E === normalizedSelectedElement)
      if (currentElement) {
        const allIsotopes = getAllNuclidesByElement(db, currentElement.Z)
        setIsotopes(allIsotopes)

        // Fetch atomic radii data
        const radiiData = getAtomicRadii(db, currentElement.Z)
        setAtomicRadii(radiiData)

        // Determine target mass number from URL or automatic isotope selection (D/T)
        const urlMassParam = searchParams.get('A')
        const autoMass =
          selectedElement === 'D' ? 2 :
          selectedElement === 'T' ? 3 :
          null

        let massNumber: number | null = urlMassParam ? parseInt(urlMassParam) : null
        if (autoMass !== null && massNumber !== autoMass) {
          // Update URL to reflect the isotope-specific selection
          const newParams = new URLSearchParams(searchParams)
          newParams.set('A', String(autoMass))
          setSearchParams(newParams, { replace: true })
          massNumber = autoMass
        }

        if (massNumber != null && !isNaN(massNumber)) {
          const foundIsotope = allIsotopes.find(iso => {
            const A = iso.type === 'full' ? iso.data.A : iso.data.A
            return A === massNumber
          })

          if (foundIsotope) {
            if (foundIsotope.type === 'full') {
              // Full nuclide from NuclidesPlus - show normal card
              setSelectedNuclide(foundIsotope.data)
              setRequestedMissingNuclide(null)
              setRadioactiveNuclideData(null)
            } else {
              // RadioNuclides-only - fetch full decay data and show radioactive card
              setShowLimitedDataNuclides(true)
              setSelectedNuclide(null)
              const radioactiveData = getRadioactiveNuclideData(db, currentElement.E, massNumber)
              if (radioactiveData) {
                setRadioactiveNuclideData(radioactiveData)
                setRequestedMissingNuclide(null)
              } else {
                setRadioactiveNuclideData(null)
                setRequestedMissingNuclide({ E: currentElement.E, A: massNumber })
              }
            }
          } else {
            // Not found in either table - show missing nuclide message
            setSelectedNuclide(null)
            setRadioactiveNuclideData(null)
            setRequestedMissingNuclide({ E: currentElement.E, A: massNumber })
          }
        } else {
          setSelectedNuclide(null) // Reset nuclide selection when element changes
          setRequestedMissingNuclide(null)
          setRadioactiveNuclideData(null)
        }
      }
    } else {
      setIsotopes([])
      setSelectedNuclide(null)
      setAtomicRadii(null)
      setRequestedMissingNuclide(null)
      setRadioactiveNuclideData(null)
    }
  }, [db, normalizedSelectedElement, selectedElement, allElements, searchParams])

  // Sync activeTab with URL param
  useEffect(() => {
    const tabParam = searchParams.get('tab') || 'integrated'
    if (tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams, activeTab])

  // Clear pinned limited-data nuclide when toggle is turned off
  useEffect(() => {
    if (!showLimitedDataNuclides && radioactiveNuclideData) {
      setRadioactiveNuclideData(null)
      // Also clear the A parameter from URL if it was showing a limited-data nuclide
      const aParam = searchParams.get('A')
      if (aParam) {
        const massNumber = parseInt(aParam)
        // Check if this A corresponds to a limited-data nuclide (not in isotopes as 'full')
        const isLimitedData = isotopes.some(iso =>
          iso.type === 'radioactive-only' && iso.data.A === massNumber
        )
        if (isLimitedData) {
          const newParams = new URLSearchParams(searchParams)
          newParams.delete('A')
          setSearchParams(newParams, { replace: true })
        }
      }
    }
  }, [showLimitedDataNuclides, radioactiveNuclideData, isotopes, searchParams, setSearchParams])

  // Restore filters from URL on mount
  useEffect(() => {
    const restoredElementsFilters: Record<string, any> = {}
    const restoredNuclidesFilters: Record<string, any> = {}
    const restoredDecaysFilters: Record<string, any> = {}

    searchParams.forEach((value, key) => {
      if (key.startsWith('ef_')) {
        try {
          restoredElementsFilters[key.substring(3)] = JSON.parse(value)
        } catch (e) {
          console.error('Failed to parse filter param:', key, value)
        }
      } else if (key.startsWith('nf_')) {
        try {
          restoredNuclidesFilters[key.substring(3)] = JSON.parse(value)
        } catch (e) {
          console.error('Failed to parse filter param:', key, value)
        }
      } else if (key.startsWith('df_')) {
        try {
          restoredDecaysFilters[key.substring(3)] = JSON.parse(value)
        } catch (e) {
          console.error('Failed to parse filter param:', key, value)
        }
      }
    })

    if (Object.keys(restoredElementsFilters).length > 0) {
      setElementsFilters(restoredElementsFilters)
    }
    if (Object.keys(restoredNuclidesFilters).length > 0) {
      setNuclidesFilters(restoredNuclidesFilters)
    }
    if (Object.keys(restoredDecaysFilters).length > 0) {
      setDecaysFilters(restoredDecaysFilters)
    }
  }, []) // Only run once on mount

  // Load custom presets from localStorage on mount
  useEffect(() => {
    try {
      const elementsPresetsJson = localStorage.getItem('lenr-filter-presets-elements')
      if (elementsPresetsJson) {
        setCustomElementsPresets(JSON.parse(elementsPresetsJson))
      }
    } catch (e) {
      console.error('Failed to load elements presets from localStorage:', e)
    }

    try {
      const nuclidesPresetsJson = localStorage.getItem('lenr-filter-presets-nuclides')
      if (nuclidesPresetsJson) {
        setCustomNuclidesPresets(JSON.parse(nuclidesPresetsJson))
      }
    } catch (e) {
      console.error('Failed to load nuclides presets from localStorage:', e)
    }

    try {
      const decaysPresetsJson = localStorage.getItem('lenr-filter-presets-decays')
      if (decaysPresetsJson) {
        setCustomDecaysPresets(JSON.parse(decaysPresetsJson))
      }
    } catch (e) {
      console.error('Failed to load decays presets from localStorage:', e)
    }
  }, [])

  // Auto-expand filters if active filters present or user previously expanded
  useEffect(() => {
    const hasActiveFilters = Object.keys(elementsFilters).length > 0
    const userExpanded = sessionStorage.getItem('lenr-filters-expanded-elements') === 'true'

    if (hasActiveFilters || userExpanded) {
      setElementsCollapsed(false)
    }
  }, [elementsFilters])

  useEffect(() => {
    const hasActiveFilters = Object.keys(nuclidesFilters).length > 0
    const userExpanded = sessionStorage.getItem('lenr-filters-expanded-nuclides') === 'true'

    if (hasActiveFilters || userExpanded) {
      setNuclidesCollapsed(false)
    }
  }, [nuclidesFilters])

  useEffect(() => {
    const hasActiveFilters = Object.keys(decaysFilters).length > 0
    const userExpanded = sessionStorage.getItem('lenr-filters-expanded-decays') === 'true'

    if (hasActiveFilters || userExpanded) {
      setDecaysCollapsed(false)
    }
  }, [decaysFilters])

  // Handler to update element selection and URL
  const handleElementClick = (elementSymbol: string) => {
    const normalizedSymbol = normalizeElementSymbol(elementSymbol)
    const clickedElement = allElements.find(el => el.E === normalizedSymbol)
    if (clickedElement) {
      setSelectedElement(elementSymbol)
      if (selectedParticle !== null) {
        setSelectedParticle(null)
      }
      const newParams = new URLSearchParams(searchParams)
      newParams.set('tab', 'integrated')
      const isHydrogenIsotope = elementSymbol === 'D' || elementSymbol === 'T'

      if (isHydrogenIsotope) {
        newParams.set('iso', elementSymbol)
        newParams.set('Z', '1')
        newParams.set('A', elementSymbol === 'D' ? '2' : '3')
      } else {
        newParams.delete('iso')
        newParams.set('Z', clickedElement.Z.toString())
        newParams.delete('A') // Clear isotope selection for non-isotopes
      }
      newParams.delete('particle')

      setSearchParams(newParams) // Push new history entry for browser back/forward
    }
  }

  const handleSegreNuclideClick = (nuclide: ChartNuclide) => {
    const newParams = new URLSearchParams(searchParams)
    newParams.set('Z', nuclide.Z.toString())
    newParams.set('A', nuclide.A.toString())
    newParams.set('tab', 'integrated')
    newParams.delete('iso')
    newParams.delete('particle')
    setSearchParams(newParams)
  }

  const handleParticleClick = (particleId: string) => {
    if (!SPECIAL_PARTICLES_BY_ID[particleId]) return
    if (selectedElement !== null) {
      setSelectedElement(null)
    }
    setSelectedParticle(particleId)
    setSelectedNuclide(null)
    setRadioactiveNuclideData(null)
    setRequestedMissingNuclide(null)

    const newParams = new URLSearchParams(searchParams)
    newParams.set('tab', 'integrated')
    newParams.set('particle', particleId)
    newParams.delete('Z')
    newParams.delete('A')
    newParams.delete('iso')
    setSearchParams(newParams, { replace: true })
  }

  // Handler to update nuclide selection and URL
  const handleNuclideClick = (displayNuclide: DisplayNuclide) => {
    const newParams = new URLSearchParams(searchParams)
    let nuclideData: RadioNuclideListItem | Nuclide

    if (displayNuclide.type === 'full') {
      const fullNuclide = displayNuclide.data
      setSelectedNuclide(fullNuclide)
      nuclideData = fullNuclide
    } else {
      const radioactiveOnly = displayNuclide.data
      setSelectedNuclide(null)
      nuclideData = radioactiveOnly
    }

    const isSpecialParticle = SPECIAL_PARTICLE_IDS.includes(nuclideData.E as any)

    if (isSpecialParticle) {
      setSelectedElement(null)
      setSelectedParticle(nuclideData.E as string)
      newParams.set('particle', nuclideData.E as string)
      newParams.delete('Z')
      newParams.delete('A')
      newParams.delete('iso')
      setSearchParams(newParams, { replace: true })
      return
    }

    newParams.set('Z', nuclideData.Z.toString())
    newParams.set('A', nuclideData.A.toString())
    newParams.delete('particle')

    if (nuclideData.Z === 1) {
      if (nuclideData.A === 2) {
        newParams.set('iso', 'D')
        setSelectedElement('D')
      } else if (nuclideData.A === 3) {
        newParams.set('iso', 'T')
        setSelectedElement('T')
      } else {
        newParams.delete('iso')
        setSelectedElement('H')
      }
    } else {
      newParams.delete('iso')
    }

    setSearchParams(newParams, { replace: true })
  }

  // Check if any limited-data (radioactive-only) nuclides exist
  const hasLimitedDataNuclides = useMemo(() => {
    return isotopes.some(displayNuclide => displayNuclide.type === 'radioactive-only')
  }, [isotopes])

  // Check if ALL isotopes are limited-data (no full nuclides available)
  const allIsotopesAreLimitedData = useMemo(() => {
    return isotopes.length > 0 && isotopes.every(displayNuclide => displayNuclide.type === 'radioactive-only')
  }, [isotopes])

  // Auto-enable toggle when all isotopes are limited-data
  useEffect(() => {
    if (allIsotopesAreLimitedData) {
      setShowLimitedDataNuclides(true)
    }
  }, [allIsotopesAreLimitedData])

  // Filter isotopes based on limited-data visibility toggle
  const visibleIsotopes = useMemo(() => {
    if (showLimitedDataNuclides) {
      return isotopes // Show all isotopes (both full and radioactive-only)
    }

    // Only show full nuclides from NuclidesPlus (hide radioactive-only entries)
    return isotopes.filter(displayNuclide => displayNuclide.type === 'full')
  }, [isotopes, showLimitedDataNuclides])

  // Ground-state half-life for full-data (NuclidesPlus) isotopes, keyed by "Z-A".
  // Looked up by Z/A because RadioNuclides files tritium under 'H' while
  // NuclidesPlus uses 'T'; matched on LHL so isomer rows are ignored.
  const fullIsotopeHalfLives = useMemo(() => {
    if (!db) return new Map<string, { halfLife: number | null; units: string | null }>()
    const fullIsotopes = isotopes
      .filter(displayNuclide => displayNuclide.type === 'full')
      .map(displayNuclide => ({
        Z: displayNuclide.data.Z,
        A: displayNuclide.data.A,
        // Match the RadioNuclides ground-state row, not an isomer (e.g. Co-60m)
        logHalfLife: typeof displayNuclide.data.logHalfLife === 'number' ? displayNuclide.data.logHalfLife : null,
      }))
    return getNuclideHalfLives(db, fullIsotopes)
  }, [db, isotopes])

  // Filter configurations
  const elementsFilterConfigs: FilterConfig[] = [
    {
      key: 'period',
      label: t('elements.period'),
      type: 'select',
      options: Array.from(new Set(allElements.map(el => el.Period)))
        .filter(p => p != null)
        .sort((a, b) => a - b)
        .map(p => ({ value: p, label: `${t('elements.period')} ${p}` })),
      placeholder: t('common.select')
    },
    {
      key: 'group',
      label: t('elements.group'),
      type: 'select',
      options: Array.from(new Set(allElements.map(el => el.Group)))
        .filter(g => g != null)
        .sort((a, b) => a - b)
        .map(g => ({ value: g, label: `${t('elements.group')} ${g}` })),
      placeholder: t('common.select')
    },
    {
      key: 'magType',
      label: t('elements.magneticType'),
      type: 'select',
      options: [
        { value: 'Ferromagnetic', label: t('elements.ferromagnetic') },
        { value: 'Paramagnetic', label: t('elements.paramagnetic') },
        { value: 'Diamagnetic', label: t('elements.diamagnetic') }
      ],
      placeholder: t('common.select')
    },
    {
      key: 'atomicWeight',
      label: t('elements.atomicWeight'),
      type: 'range',
      min: 0,
      max: 300,
      step: 0.1
    },
    {
      key: 'melting',
      label: `${t('elements.meltingPoint')} (K)`,
      type: 'range',
      min: 0,
      max: 4000,
      step: 10
    },
    {
      key: 'boiling',
      label: `${t('elements.boilingPoint')} (K)`,
      type: 'range',
      min: 0,
      max: 6000,
      step: 10
    },
    {
      key: 'density',
      label: `${t('elements.densitySTP')} (g/cm³)`,
      type: 'range',
      min: 0,
      max: 25,
      step: 0.1
    }
  ]

  const elementsPresets: FilterPreset[] = [
    {
      id: 'ferromagnetic',
      label: t('elements.ferromagneticElements'),
      filters: { magType: 'Ferromagnetic' }
    },
    {
      id: 'paramagnetic',
      label: t('elements.paramagneticElements'),
      filters: { magType: 'Paramagnetic' }
    },
    {
      id: 'diamagnetic',
      label: t('elements.diamagneticElements'),
      filters: { magType: 'Diamagnetic' }
    },
    {
      id: 'light-elements',
      label: t('elements.lightElements'),
      filters: { atomicWeight: { max: 40 } }
    },
    {
      id: 'transition-metals',
      label: t('elements.transitionMetals'),
      filters: { period: 4, group: null }
    },
    {
      id: 'noble-gases',
      label: t('elements.nobleGases'),
      filters: { group: 18 }
    }
  ]

  const nuclidesFilterConfigs: FilterConfig[] = [
    {
      key: 'element',
      label: t('elements.element'),
      type: 'element-selector',
      availableElements: allElements
    },
    {
      key: 'zRange',
      label: t('elements.atomicNumberZ'),
      type: 'range',
      min: 1,
      max: 118,
      step: 1
    },
    {
      key: 'aRange',
      label: t('elements.massNumberA'),
      type: 'range',
      min: 1,
      max: 300,
      step: 1
    },
    {
      key: 'bindingEnergy',
      label: t('elements.bindingEnergyMeV'),
      type: 'range',
      min: 0,
      max: 2000,
      step: 1
    },
    {
      key: 'nBorF',
      label: t('elements.nuclearType'),
      type: 'select',
      options: [
        { value: 'b', label: t('elements.boson') },
        { value: 'f', label: t('elements.fermion') }
      ],
      placeholder: t('common.select')
    },
    {
      key: 'aBorF',
      label: t('elements.atomicProperties'),
      type: 'select',
      options: [
        { value: 'b', label: t('elements.boson') },
        { value: 'f', label: t('elements.fermion') }
      ],
      placeholder: t('common.select')
    },
    {
      key: 'onlyStable',
      label: `${t('elements.stable')} (log₁₀(${t('elements.halfLife')}) > 9)`,
      type: 'toggle'
    },
    {
      key: 'onlyRadioactive',
      label: t('elements.unstable'),
      type: 'toggle'
    }
  ]

  const nuclidesPresets: FilterPreset[] = [
    {
      id: 'stable-nuclides',
      label: `${t('elements.stable')} ${t('elements.nuclides')}`,
      filters: { onlyStable: true }
    },
    {
      id: 'radioactive-nuclides',
      label: `${t('elements.unstable')} ${t('elements.nuclides')}`,
      filters: { onlyRadioactive: true }
    },
    {
      id: 'nuclear-bosons',
      label: `${t('elements.nuclearType')} ${t('elements.boson')}`,
      filters: { nBorF: 'b' }
    },
    {
      id: 'nuclear-fermions',
      label: `${t('elements.nuclearType')} ${t('elements.fermion')}`,
      filters: { nBorF: 'f' }
    },
    {
      id: 'light-nuclides',
      label: t('elements.lightElements'),
      filters: { zRange: { max: 20 } }
    },
    {
      id: 'heavy-nuclides',
      label: `${t('elements.nuclides')} (Z > 82)`,
      filters: { zRange: { min: 83 } }
    }
  ]

  const decaysFilterConfigs: FilterConfig[] = useMemo(() => {
    if (!db) return []

    return [
      {
        key: 'element',
        label: t('elements.element'),
        type: 'element-selector',
        availableElements: allElements
      },
      {
        key: 'decayMode',
        label: t('elements.decayMode'),
        type: 'badge-selector',
        colorScheme: 'purple',
        options: getUniqueDecayModes(db).map(m => ({ value: m, label: m })),
        tooltipInfo: localizeRadiationTypeInfo(t)
      },
      {
        key: 'radiationType',
        label: t('elements.radiationType'),
        type: 'badge-selector',
        colorScheme: 'blue',
        options: getUniqueRadiationTypes(db).map(r => ({ value: r, label: r })),
        tooltipInfo: localizeRadiationTypeInfo(t)
      },
      {
        key: 'energy',
        label: t('elements.energyKeV'),
        type: 'range',
        min: 0,
        max: 10000,
        step: 1
      },
      {
        key: 'intensity',
        label: t('elements.intensityPercent'),
        type: 'range',
        min: 0,
        max: 100,
        step: 0.1
      }
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, allElements, t])

  const decaysPresets: FilterPreset[] = [
    {
      id: 'alpha-decay',
      label: t('elementData.presets.alphaDecay'),
      filters: { decayMode: ['A'] }
    },
    {
      id: 'beta-minus',
      label: t('elementData.presets.betaMinusDecay'),
      filters: { decayMode: ['B-'] }
    },
    {
      id: 'beta-plus',
      label: t('elementData.presets.betaPlusDecay'),
      filters: { decayMode: ['B+'] }
    },
    {
      id: 'gamma-radiation',
      label: t('elementData.presets.gammaRadiation'),
      filters: { radiationType: ['G'] }
    },
    {
      id: 'high-energy',
      label: `${t('reactions.energy')} > 1000 keV`,
      filters: { energy: { min: 1000 } }
    },
    {
      id: 'high-intensity',
      label: `${t('elements.intensity')} > 50%`,
      filters: { intensity: { min: 50 } }
    }
  ]

  // Elements table columns (memoized to avoid unnecessary re-renders in useColumnVisibility)
  const elementsColumns: TableColumn<Element>[] = useMemo(() => [
    { key: 'Z', label: 'Z', sortable: true },
    {
      key: 'E',
      label: t('elements.symbol'),
      sortable: true,
      render: (val) => (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          {val}
        </span>
      )
    },
    { key: 'EName', label: t('elements.name'), sortable: true },
    { key: 'Period', label: t('elements.period'), sortable: true },
    { key: 'Group', label: t('elements.group'), sortable: true },
    {
      key: 'AWeight',
      label: t('elements.atomicWeight'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(3) : '-'
    },
    {
      key: 'Melting',
      label: t('elementData.columns.meltingK'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'Boiling',
      label: t('elementData.columns.boilingK'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'STPDensity',
      label: t('elementData.columns.densityGcm3'),
      sortable: true,
      render: (val) => val != null ? Number(densityToGPerCm3(Number(val)).toPrecision(4)).toString() : '-'
    }
  ], [t])

  // Nuclides table columns (memoized; depends on radioactiveNuclides for stability render)
  const nuclidesColumns: TableColumn<Nuclide>[] = useMemo(() => [
    {
      key: 'E',
      label: t('elements.element'),
      sortable: true,
      render: (val) => (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          {val}
        </span>
      )
    },
    { key: 'Z', label: 'Z', sortable: true },
    { key: 'A', label: 'A', sortable: true },
    {
      key: 'BE',
      label: t('elements.bindingEnergyMeV'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(3) : '-'
    },
    {
      key: 'AMU',
      label: t('elementData.columns.massAmu'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(6) : '-'
    },
    {
      key: 'nBorF',
      label: t('reactions.nuclear'),
      sortable: true,
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          val === 'b'
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
            : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
        }`}>
          {val === 'b' ? t('elements.boson') : t('elements.fermion')}
        </span>
      )
    },
    {
      key: 'aBorF',
      label: t('reactions.atomic'),
      sortable: true,
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          val === 'b'
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
            : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
        }`}>
          {val === 'b' ? t('elements.boson') : t('elements.fermion')}
        </span>
      )
    },
    {
      key: 'logHalfLife',
      label: t('elements.logHalfLife'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'stability',
      label: t('elements.stability'),
      sortable: false,
      render: (_, row) => {
        const isStable = typeof row.logHalfLife === 'number' && row.logHalfLife > 9
        const isRadioactive = radioactiveNuclides.has(`${row.Z}-${row.A}`)

        return (
          <div className="flex items-center gap-2">
            {isStable && isRadioactive ? (
              // Radioactive with half-life > 1e9 y (U-238, K-40): not "Stable"
              <span
                data-testid="nuclide-long-lived"
                title={t('elements.longLivedTooltip')}
                className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                {t('elements.longLived')}
              </span>
            ) : isStable ? (
              <span className="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                {t('elements.stable')}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                {t('elements.unstable')}
              </span>
            )}
            {isRadioactive && (
              <span title={t('reactions.radioactive')}>
                <Radiation className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </span>
            )}
          </div>
        )
      }
    }
  ], [radioactiveNuclides, t])

  // Decays table columns (memoized to avoid unnecessary re-renders in useColumnVisibility)
  const decaysColumns: TableColumn<RadioactiveDecay>[] = useMemo(() => [
    {
      key: 'E',
      label: t('elements.element'),
      sortable: true,
      render: (val) => (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          {val}
        </span>
      )
    },
    { key: 'Z', label: 'Z', sortable: true },
    { key: 'A', label: 'A', sortable: true },
    {
      key: 'RDM',
      label: t('elements.decayMode'),
      sortable: true,
      render: (val) => val ? (
        <Tooltip content={getDecayModeTooltip(val, t)}>
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
            {val}
          </span>
        </Tooltip>
      ) : '-'
    },
    {
      key: 'RT',
      label: t('elements.radiationType'),
      sortable: true,
      render: (val) => val ? (
        <Tooltip content={getRadiationTypeTooltip(val, t)}>
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            {val}
          </span>
        </Tooltip>
      ) : '-'
    },
    {
      key: 'halfLife',
      label: t('elements.halfLife'),
      sortable: true,
      render: (val, row) => {
        if (val == null) return '-'
        const units = expandHalfLifeUnit(row.Units)
        return `${Number(val).toExponential(2)} ${units}`
      }
    },
    {
      key: 'DEKeV',
      label: t('elements.energyKeV'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'RI',
      label: t('elements.intensityPercent'),
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    }
  ], [t])

  // Column visibility hooks for each table
  const elementsColumnVis = useColumnVisibility(elementsColumns, 'elements')
  const nuclidesColumnVis = useColumnVisibility(nuclidesColumns, 'nuclides')
  const decaysColumnVis = useColumnVisibility(decaysColumns, 'decays')

  if (dbLoading) {
    return <DatabaseLoadingCard downloadProgress={downloadProgress} />
  }

  // Throw error to ErrorBoundary so it renders outside Layout (without sidebar)
  if (dbError) {
    throw dbError
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page title bar - collapses upward when tabs stick on mobile */}
      <div
        className={`mb-6 overflow-hidden transition-all duration-300 ease-in-out ${
          isTabsStuck ? 'max-h-0 opacity-0 -translate-y-4 mb-0' : 'max-h-32 opacity-100 translate-y-0'
        }`}
      >
        <PageHeader
          icon={PAGE_ICONS.elementData}
          title={t('navigation.showElementData')}
          subtitle={t('elementData.subtitle')}
          className=""
        />
      </div>

      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onMenuClick={openSidebar}
        onStuckChange={handleTabsStuckChange}
        className="mb-6"
      />

      {/* Integrated Tab */}
      {activeTab === 'integrated' && (
        <div>
          <PeriodicTable
            availableElements={allElements}
            selectedElement={selectedElement}
            selectedParticle={selectedParticle}
            onElementClick={handleElementClick}
            onParticleClick={handleParticleClick}
          />

          {/* Collapsible Segre Chart */}
          {chartNuclides.length > 0 && (
            <div className="card mt-6">
              <button
                onClick={() => setSegreExpanded(!segreExpanded)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-lg"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {t('segreChart.sectionTitle')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('segreChart.nuclideCount', { count: chartNuclides.length })}
                  </p>
                </div>
                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${segreExpanded ? 'rotate-180' : ''}`} />
              </button>
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${segreExpanded ? 'max-h-[900px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-4">
                  <SegreChartDiagram nuclides={chartNuclides} onNuclideClick={handleSegreNuclideClick} />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                    {t('segreChart.zoomControls')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedParticleInfo && (
            <ParticleDetailsCard particle={selectedParticleInfo} nuclide={selectedParticleNuclide} />
          )}

          {element && (
            <div className="space-y-6 mt-6">
              <div className="card p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{element.EName} ({element.E})</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('elements.atomicNumber')}: {element.Z}</p>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">{t('elements.periodicTable')}</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.period')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Period}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.group')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Group}</dd>
                      </div>
                      {typeof element.AWeight === 'number' && !isNaN(element.AWeight) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.atomicWeight')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.AWeight.toFixed(3)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">{t('elements.atomicProperties')}</h3>
                    <dl className="space-y-2 text-sm">
                      {element.Valence !== null && element.Valence !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.valence')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Valence}</dd>
                        </div>
                      )}
                      {element.Negativity !== null && element.Negativity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.electronegativity')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Negativity}</dd>
                        </div>
                      )}
                      {element.Affinity !== null && element.Affinity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.electronAffinity')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Affinity} kJ/mol</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">{t('elements.ionization')}</h3>
                    <dl className="space-y-2 text-sm">
                      {element.MaxIonNum !== null && element.MaxIonNum !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.maxIonNumber')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonNum}</dd>
                        </div>
                      )}
                      {typeof element.MaxIonization === 'number' && !isNaN(element.MaxIonization) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.maxIonization')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonization.toFixed(1)} kJ/mol</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">{t('elements.thermalProperties')}</h3>
                  <dl className="space-y-2 text-sm">
                    {typeof element.Melting === 'number' && !isNaN(element.Melting) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.meltingPoint')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Melting.toFixed(2)} K</dd>
                      </div>
                    )}
                    {typeof element.Boiling === 'number' && !isNaN(element.Boiling) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.boilingPoint')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Boiling.toFixed(2)} K</dd>
                      </div>
                    )}
                    {typeof element.SpecHeat === 'number' && !isNaN(element.SpecHeat) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.specificHeat')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{formatSpecificHeat(element.SpecHeat)}</dd>
                      </div>
                    )}
                    {typeof element.ThermConduct === 'number' && !isNaN(element.ThermConduct) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.thermalConductivity')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ThermConduct.toFixed(2)} W/(m·K)</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">{t('elements.physicalProperties')}</h3>
                  <dl className="space-y-2 text-sm">
                    {typeof element.STPDensity === 'number' && !isNaN(element.STPDensity) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.densitySTP')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{formatDensity(element.STPDensity)}</dd>
                      </div>
                    )}
                    {typeof element.MolarVolume === 'number' && !isNaN(element.MolarVolume) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.molarVolume')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MolarVolume.toFixed(2)} cm³/mol</dd>
                      </div>
                    )}
                    {typeof element.ElectConduct === 'number' && !isNaN(element.ElectConduct) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.electricalConductivity')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ElectConduct.toFixed(2)} MS/m</dd>
                      </div>
                    )}
                    {element.MagType && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">{t('elements.magneticType')}:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MagType}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {atomicRadii && (
                  <div className="card p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">{t('elements.atomicRadii')}</h3>
                    <dl className="space-y-2 text-sm">
                      {atomicRadii.empirical !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.empirical')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.empirical} pm</dd>
                        </div>
                      )}
                      {atomicRadii.calculated !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.calculated')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.calculated} pm</dd>
                        </div>
                      )}
                      {atomicRadii.vanDerWaals !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.vanDerWaals')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.vanDerWaals} pm</dd>
                        </div>
                      )}
                      {atomicRadii.covalent !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.covalent')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.covalent} pm</dd>
                        </div>
                      )}
                    </dl>
                    <div
                      data-testid="atomic-radii-legend"
                      className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1"
                    >
                      {ATOMIC_RADII_LEGEND.map(([labelKey, descKey]) => (
                        <div key={labelKey} className="min-w-0">
                          <span className="font-semibold">{t(labelKey)}:</span>{' '}
                          <span>{t(descKey)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Documented in — citations referencing this element */}
              {element && (() => {
                const elementCitations = getCitationsForElement(element.Z)
                if (elementCitations.length === 0) return null
                return (
                  <div className="card p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                      {t('citations.documentedIn', { defaultValue: 'Documented in' })}
                      <CitationBadge
                        citationIds={elementCitations.map((c) => c.id)}
                        placement="corner"
                      />
                    </h3>
                    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                      {elementCitations.map((c) => {
                        const href = c.doi ? `https://doi.org/${c.doi}` : c.url
                        return (
                          <li key={c.id} className="leading-snug">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {c.authors} ({c.year}):
                            </span>{' '}
                            {c.excerpt}
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1.5 inline-flex items-center gap-0.5 text-primary-600 dark:text-primary-400 hover:underline text-xs whitespace-nowrap"
                              >
                                {t('elementData.viewSource')}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })()}

              {/* Nuclides Section */}
              {isotopes.length > 0 ? (
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {t('elements.nuclidesShown', { shown: visibleIsotopes.length, total: isotopes.length })}
                    </h3>

                    {/* Toggle for limited-data nuclides (RadioNuclides-only entries) */}
                    <label className={`flex items-center gap-3 ${hasLimitedDataNuclides && !allIsotopesAreLimitedData ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {t('elements.includeLimitedData')}
                        {allIsotopesAreLimitedData && (
                          <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">{t('elementData.required')}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showLimitedDataNuclides && hasLimitedDataNuclides}
                        disabled={!hasLimitedDataNuclides || allIsotopesAreLimitedData}
                        onClick={() => hasLimitedDataNuclides && !allIsotopesAreLimitedData && setShowLimitedDataNuclides(!showLimitedDataNuclides)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          hasLimitedDataNuclides && !allIsotopesAreLimitedData ? 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800' : ''
                        } ${
                          showLimitedDataNuclides && hasLimitedDataNuclides
                            ? 'bg-blue-600'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            showLimitedDataNuclides && hasLimitedDataNuclides ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  {/* Isotope selection cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                    {visibleIsotopes.map((displayNuclide, idx) => {
                      const isFull = displayNuclide.type === 'full'
                      const A = displayNuclide.data.A
                      const E = displayNuclide.data.E
                      const Z = displayNuclide.data.Z

                      // Check if this isotope is currently selected/displayed
                      const isSelected = isFull
                        ? selectedNuclide?.id === displayNuclide.data.id
                        : radioactiveNuclideData?.A === A && radioactiveNuclideData?.Z === Z

                      // For full nuclides, check stability
                      const isStable = isFull && typeof displayNuclide.data.logHalfLife === 'number' && displayNuclide.data.logHalfLife > 9

                      // Full nuclides with RadioNuclides decay records (e.g. T-3) are radioactive
                      const fullHalfLife = isFull ? fullIsotopeHalfLives.get(`${Z}-${A}`) : undefined

                      // Format half-life for radioactive-only entries and radioactive full nuclides
                      const halfLifeStr = isFull
                        ? formatCompactHalfLife(fullHalfLife?.halfLife ?? null, fullHalfLife?.units ?? null)
                        : formatCompactHalfLife(displayNuclide.data.halfLife, displayNuclide.data.Units)

                      return (
                        <IsotopeCard
                          key={`${E}-${A}-${idx}`}
                          E={E}
                          A={A}
                          Z={Z}
                          nBorF={displayNuclide.type === 'full' ? displayNuclide.data.nBorF : undefined}
                          stable={isStable}
                          longLived={isFull && isStable && fullHalfLife !== undefined}
                          radioactive={isFull && fullHalfLife !== undefined}
                          halfLife={isFull ? halfLifeStr : null}
                          limitedData={displayNuclide.type === 'full' ? undefined : {
                            decayMode: displayNuclide.data.RDM,
                            halfLife: halfLifeStr,
                          }}
                          selected={isSelected}
                          onClick={() => handleNuclideClick(displayNuclide)}
                        />
                      )
                    })}
                  </div>

                  {/* Selected nuclide details */}
                  {selectedNuclide && (
                    <div className="mt-4">
                      <NuclideDetailsCard nuclide={selectedNuclide} />
                    </div>
                  )}

                  {/* Radioactive nuclide from RadioNuclides table */}
                  {!selectedNuclide && radioactiveNuclideData && (
                    <div className="mt-4">
                      <RadioactiveNuclideCard nuclideData={radioactiveNuclideData} />
                    </div>
                  )}

                  {/* Missing nuclide message */}
                  {!selectedNuclide && !radioactiveNuclideData && requestedMissingNuclide && (
                    <div className="mt-4 p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg">
                      <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
                        {t('elementData.nuclideNotAvailable')}
                      </h3>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">
                        <Trans
                          i18nKey="elementData.nuclideNotAvailableMessage"
                          values={{ nuclide: `${requestedMissingNuclide.E}-${requestedMissingNuclide.A}` }}
                          components={{ strong: <strong /> }}
                        />
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {t('elementData.availableNuclidesShown', { element: element?.EName ?? '' })}
                      </p>
                    </div>
                  )}
                </div>
              ) : element ? (
                <div className="card p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800">
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
                    {t('elementData.noNuclidesAvailable')}
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
                    <Trans
                      i18nKey="elementData.noNuclidesForElement"
                      values={{ element: `${element.EName} (${element.E})` }}
                      components={{ strong: <strong /> }}
                    />
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    {t('elementData.elementNotInDataset')}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}


      {/* Russell Tab */}
      {activeTab === 'russell' && (
        <div className="space-y-4">
          {/* View toggle */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
            <button
              onClick={() => setRussellView('grid')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                russellView === 'grid'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('russellChart.gridView')}
            </button>
            <button
              onClick={() => setRussellView('wave')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                russellView === 'wave'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('russellChart.waveView')}
            </button>
            <button
              onClick={() => setRussellView('3d')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                russellView === '3d'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('russellChart.view3D')}
            </button>
          </div>

          {/* Diagram card */}
          <div className="card p-6">
            {russellView === 'grid' ? (
              <RussellChartDiagram onElementClick={(Z) => {
                const newParams = new URLSearchParams(searchParams)
                newParams.set('Z', String(Z))
                newParams.set('tab', 'integrated')
                setSearchParams(newParams)
              }} />
            ) : russellView === '3d' ? (
              <RussellChart3D onElementClick={(Z) => {
                const newParams = new URLSearchParams(searchParams)
                newParams.set('Z', String(Z))
                newParams.set('tab', 'integrated')
                setSearchParams(newParams)
              }} />
            ) : (
              <RussellWaveDiagram onElementClick={(Z) => {
                const newParams = new URLSearchParams(searchParams)
                newParams.set('Z', String(Z))
                newParams.set('tab', 'integrated')
                setSearchParams(newParams)
              }} />
            )}
          </div>

          {/* Legend card */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('russellChart.legend')}
            </h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border"
                  style={{
                    backgroundColor: theme === 'dark' ? RUSSELL_COLORS.generation.bg.dark : RUSSELL_COLORS.generation.bg.light,
                    borderColor: theme === 'dark' ? RUSSELL_COLORS.generation.dark : RUSSELL_COLORS.generation.light,
                  }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('russellChart.legendGeneration')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border"
                  style={{
                    backgroundColor: theme === 'dark' ? RUSSELL_COLORS.radiation.bg.dark : RUSSELL_COLORS.radiation.bg.light,
                    borderColor: theme === 'dark' ? RUSSELL_COLORS.radiation.dark : RUSSELL_COLORS.radiation.light,
                  }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('russellChart.legendRadiation')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border"
                  style={{
                    backgroundColor: theme === 'dark' ? RUSSELL_COLORS.inertGas.bg.dark : RUSSELL_COLORS.inertGas.bg.light,
                    borderColor: theme === 'dark' ? RUSSELL_COLORS.inertGas.dark : RUSSELL_COLORS.inertGas.light,
                  }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('russellChart.legendInertGas')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border-2"
                  style={{
                    backgroundColor: theme === 'dark' ? RUSSELL_COLORS.carbon.bg.dark : RUSSELL_COLORS.carbon.bg.light,
                    borderColor: theme === 'dark' ? RUSSELL_COLORS.carbon.dark : RUSSELL_COLORS.carbon.light,
                  }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('russellChart.legendCarbon')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{
                      backgroundColor: theme === 'dark' ? RUSSELL_COLORS.predicted.bg.dark : RUSSELL_COLORS.predicted.bg.light,
                      borderColor: theme === 'dark' ? RUSSELL_COLORS.predicted.dark : RUSSELL_COLORS.predicted.light,
                    }}
                  />
                  <span className="absolute -top-0.5 -right-0.5 text-[8px]" style={{ color: theme === 'dark' ? RUSSELL_COLORS.predicted.dark : RUSSELL_COLORS.predicted.light }}>
                    ★
                  </span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  {t('russellChart.legendPredicted')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{
                    backgroundColor: theme === 'dark' ? RUSSELL_COLORS.hypothetical.bg.dark : RUSSELL_COLORS.hypothetical.bg.light,
                    border: `1.5px dashed ${theme === 'dark' ? RUSSELL_COLORS.hypothetical.dark : RUSSELL_COLORS.hypothetical.light}`,
                  }}
                />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('russellChart.legendHypothetical')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5" style={{ borderTop: `2px dashed ${theme === 'dark' ? 'rgba(107, 114, 128, 0.3)' : 'rgba(156, 163, 175, 0.4)'}` }} />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('russellChart.legendSerpentine')}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              {t('russellChart.clickToView')}
            </p>
          </div>

          {/* Predictions card */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('russellChart.predictionsTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t('russellChart.predictionsDescription')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getPredictedElements().map((el) => (
                <div
                  key={el.russellName}
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(5, 150, 105, 0.05)',
                    border: `1px solid ${theme === 'dark' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(5, 150, 105, 0.15)'}`,
                  }}
                >
                  <span className="text-lg" style={{ color: theme === 'dark' ? RUSSELL_COLORS.predicted.dark : RUSSELL_COLORS.predicted.light }}>
                    ★
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {t('russellChart.predictionFormat', { russellName: el.russellName, modernName: el.modernName, symbol: el.modernSymbol })}
                    </div>
                    {el.note && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t(el.note)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* About card */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('russellChart.aboutTitle')}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
              <p>{t('russellChart.aboutParagraph1')}</p>
              <p>{t('russellChart.aboutParagraph2')}</p>
              <p>{t('russellChart.aboutParagraph3')}</p>
            </div>
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t('russellChart.experimentalNote')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Elements Tab */}
      {activeTab === 'elements' && (
        <div className="space-y-4">
          <FilterPanel
            collapsed={elementsCollapsed}
            onToggleCollapsed={handleElementsToggleCollapsed}
            searchTerm={elementsSearch}
            onSearchChange={setElementsSearch}
            searchPlaceholder={t('elementData.searchElements')}
            onExport={handleElementsExport}
            exportDisabled={filteredElements.length === 0}
            dataCount={filteredElements.length}
            totalCount={allElements.length}
            filters={elementsFilters}
            filterConfigs={elementsFilterConfigs}
            presets={[...elementsPresets, ...customElementsPresets]}
            onFilterChange={handleElementsFilterChange}
            onApplyPreset={handleElementsApplyPreset}
            onClearAll={handleElementsClearFilters}
            onSavePreset={handleElementsSavePreset}
            onDeletePreset={handleElementsDeletePreset}
          />

          <div className="card p-6">
            <SortableTable
              data={filteredElements}
              columns={elementsColumnVis.visibleColumns}
              expandedRows={elementsExpandedRows}
              onExpandedRowsChange={setElementsExpandedRows}
              title={
                <div className="flex items-center gap-3">
                  <span>{t('elementData.elementsTable')}</span>
                  <ColumnToggle {...elementsColumnVis} />
                </div>
              }
              description={t('elementData.elementsTableDescription')}
              autoFillHeight
              autoFillHeightOffset={80}
              minVisibleRows={10}
              virtualizationThreshold={10}
              renderExpandedContent={(element) => (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                      {t('elementData.chemicalProperties')}
                    </h4>
                    <dl className="space-y-2 text-sm">
                      {element.Valence !== null && element.Valence !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.valence')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Valence}</dd>
                        </div>
                      )}
                      {element.Negativity !== null && element.Negativity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.electronegativity')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Negativity}</dd>
                        </div>
                      )}
                      {element.Affinity !== null && element.Affinity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.electronAffinity')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Affinity} kJ/mol</dd>
                        </div>
                      )}
                      {element.MaxIonNum !== null && element.MaxIonNum !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.maxIonNumber')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonNum}</dd>
                        </div>
                      )}
                      <div className="flex justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <dt className="text-gray-600 dark:text-gray-400">{t('reactions.viewDetails')}:</dt>
                        <dd>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleElementClick(element.E)
                            }}
                            className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium"
                          >
                            {element.EName} ({element.E}) →
                          </button>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                      {t('elements.thermalProperties')}
                    </h4>
                    <dl className="space-y-2 text-sm">
                      {typeof element.SpecHeat === 'number' && !isNaN(element.SpecHeat) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.specificHeat')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{formatSpecificHeat(element.SpecHeat)}</dd>
                        </div>
                      )}
                      {typeof element.ThermConduct === 'number' && !isNaN(element.ThermConduct) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.thermalConductivity')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ThermConduct.toFixed(2)} W/(m·K)</dd>
                        </div>
                      )}
                      {typeof element.MolarVolume === 'number' && !isNaN(element.MolarVolume) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.molarVolume')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MolarVolume.toFixed(2)} cm³/mol</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                      {t('elementData.otherProperties')}
                    </h4>
                    <dl className="space-y-2 text-sm">
                      {typeof element.ElectConduct === 'number' && !isNaN(element.ElectConduct) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.electricalConductivity')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ElectConduct.toFixed(2)} MS/m</dd>
                        </div>
                      )}
                      {element.MagType && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.magneticType')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MagType}</dd>
                        </div>
                      )}
                      {typeof element.MaxIonization === 'number' && !isNaN(element.MaxIonization) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('elements.maxIonization')}:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonization.toFixed(1)} kJ/mol</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              )}
              getRowKey={(row) => row.Z}
            />

            {/* Pagination controls */}

          </div>
        </div>
      )}

      {/* Nuclides Tab */}
      {activeTab === 'nuclides' && (
        <div className="space-y-4">
          <FilterPanel
            collapsed={nuclidesCollapsed}
            onToggleCollapsed={handleNuclidesToggleCollapsed}
            searchTerm={nuclidesSearch}
            onSearchChange={setNuclidesSearch}
            searchPlaceholder={t('elementData.searchNuclides')}
            onExport={handleNuclidesExport}
            exportDisabled={filteredNuclides.length === 0}
            dataCount={filteredNuclides.length}
            totalCount={allNuclides.length}
            filters={nuclidesFilters}
            filterConfigs={nuclidesFilterConfigs}
            presets={[...nuclidesPresets, ...customNuclidesPresets]}
            onFilterChange={handleNuclidesFilterChange}
            onApplyPreset={handleNuclidesApplyPreset}
            onClearAll={handleNuclidesClearFilters}
            onSavePreset={handleNuclidesSavePreset}
            onDeletePreset={handleNuclidesDeletePreset}
          />

          <div className="card p-6">
            <SortableTable
              data={filteredNuclides}
              columns={nuclidesColumnVis.visibleColumns}
              expandedRows={nuclidesExpandedRows}
              onExpandedRowsChange={setNuclidesExpandedRows}
              title={
                <div className="flex items-center gap-3">
                  <span>{t('elementData.nuclidesTable')}</span>
                  <ColumnToggle {...nuclidesColumnVis} />
                </div>
              }
              description={t('elementData.nuclidesTableDescription')}
              autoFillHeight
              autoFillHeightOffset={80}
              minVisibleRows={10}
              virtualizationThreshold={10}
              renderExpandedContent={(nuclide) => {
                const hasAbundance = (nuclide.pcaNCrust && nuclide.pcaNCrust > 0) || (nuclide.ppmNSolar && nuclide.ppmNSolar > 0)
                const hasMagneticData = nuclide.SP || nuclide.MD || nuclide.Inova_MHz

                // Format status type
                const formatStatus = (sus?: string) => {
                  if (!sus) return t('elementData.status.unknown')
                  if (sus === 'SPN') return t('elementData.status.stablePrimordial')
                  if (sus === 'SYN') return t('elementData.status.synthetic')
                  if (sus === 'UPN') return t('elementData.status.unstablePrimordial')
                  return sus
                }

                return (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Natural Occurrence */}
                    {hasAbundance && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                          {t('elementData.naturalOccurrence')}
                        </h4>
                        <dl className="space-y-2 text-sm">
                          {nuclide.pcaNCrust !== null && nuclide.pcaNCrust !== undefined && nuclide.pcaNCrust > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">{t('elements.earthsCrust')}:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {nuclide.pcaNCrust.toFixed(2)}%
                                {nuclide.ppmNCrust && ` (${nuclide.ppmNCrust.toFixed(1)} ppm)`}
                              </dd>
                            </div>
                          )}
                          {nuclide.ppmNSolar !== null && nuclide.ppmNSolar !== undefined && nuclide.ppmNSolar > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">{t('elements.solarSystem')}:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {nuclide.ppmNSolar.toFixed(1)} ppm
                              </dd>
                            </div>
                          )}
                          {nuclide.SUS && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">{t('elementData.classification')}:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {formatStatus(nuclide.SUS)}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {/* Nuclear & Magnetic Properties */}
                    {hasMagneticData && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                          {t('elements.nuclearProperties')}
                        </h4>
                        <dl className="space-y-2 text-sm">
                          {nuclide.SP && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">{t('elementData.nuclearSpin')}:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.SP}</dd>
                            </div>
                          )}
                          {nuclide.MD && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">{t('elementData.magneticMoment')}:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.MD} μₙ</dd>
                            </div>
                          )}
                          {nuclide.Inova_MHz !== null && nuclide.Inova_MHz !== undefined && nuclide.Inova_MHz > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">{t('elementData.nmrFrequency')}:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.Inova_MHz.toFixed(3)} MHz</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {/* Additional Properties */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                        {t('elementData.additionalProperties')}
                      </h4>
                      <dl className="space-y-2 text-sm">
                        {nuclide.BE !== null && nuclide.BE !== undefined && nuclide.A > 0 && (
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-400">{t('elements.bePerNucleon')}:</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">{(Number(nuclide.BE) / nuclide.A).toFixed(3)} MeV</dd>
                          </div>
                        )}
                        {nuclide.RDM && (
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-400">{t('elementData.primaryDecay')}:</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.RDM}</dd>
                          </div>
                        )}
                        {nuclide.DEMeV !== null && nuclide.DEMeV !== undefined && nuclide.DEMeV > 0 && (
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-400">{t('elementData.decayEnergy')}:</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.DEMeV.toFixed(3)} MeV</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">{t('reactions.viewDetails')}:</dt>
                          <dd>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const newParams = new URLSearchParams(searchParams)
                                newParams.set('tab', 'integrated')

                                if (SPECIAL_PARTICLE_IDS.includes(nuclide.E as any)) {
                                  setSelectedElement(null)
                                  setSelectedParticle(nuclide.E as string)
                                  setSelectedNuclide(null)
                                  setRadioactiveNuclideData(null)
                                  setRequestedMissingNuclide(null)
                                  newParams.set('particle', nuclide.E as string)
                                  newParams.delete('Z')
                                  newParams.delete('A')
                                  newParams.delete('iso')
                                } else {
                                  setSelectedParticle(null)
                                  newParams.set('Z', nuclide.Z.toString())
                                  newParams.set('A', nuclide.A.toString())
                                  newParams.delete('particle')
                                }

                                setSearchParams(newParams)
                              }}
                              className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium"
                            >
                              {nuclide.E}-{nuclide.A} →
                            </button>
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )
              }}
              getRowKey={(row) => `${row.Z}-${row.A}`}
            />

            {/* Pagination controls */}

          </div>
        </div>
      )}

      {/* Decays Tab */}
      {activeTab === 'decays' && (
        <div className="space-y-4">
          <FilterPanel
            collapsed={decaysCollapsed}
            onToggleCollapsed={handleDecaysToggleCollapsed}
            searchTerm={decaysSearch}
            onSearchChange={setDecaysSearch}
            searchPlaceholder={t('elementData.searchDecays')}
            onExport={handleDecaysExport}
            exportDisabled={filteredDecays.length === 0}
            dataCount={filteredDecays.length}
            totalCount={allDecays.length}
            filters={decaysFilters}
            filterConfigs={decaysFilterConfigs}
            presets={[...decaysPresets, ...customDecaysPresets]}
            onFilterChange={handleDecaysFilterChange}
            onApplyPreset={handleDecaysApplyPreset}
            onClearAll={handleDecaysClearFilters}
            onSavePreset={handleDecaysSavePreset}
            onDeletePreset={handleDecaysDeletePreset}
          />

          <div className="card p-6">
            <SortableTable
              data={filteredDecays}
              columns={decaysColumnVis.visibleColumns}
              expandedRows={decaysExpandedRows}
              onExpandedRowsChange={handleDecaysExpandedRowsChange}
              title={
                <div className="flex items-center gap-3">
                  <span>{t('elementData.decaysTable')}</span>
                  <ColumnToggle {...decaysColumnVis} />
                </div>
              }
              description={t('elementData.decaysTableDescription')}
              autoFillHeight
              autoFillHeightOffset={80}
              minVisibleRows={10}
              virtualizationThreshold={10}
              expandedContentNoPadding={true}
              renderExpandedContent={(decay) => {
                if (!db) return null

                // Build decay chain for this nuclide
                const chain = traceDecayChain(db, decay.Z, decay.A, {
                  maxDepth: 10,
                  minBranchingRatio: 1.0
                })

                return (
                  <DecayChainDiagram
                    root={chain.root}
                    maxHeight={300}
                    showWrapper={false}
                    minimal={true}
                  />
                )
              }}
              getRowKey={(row, idx) => `${row.Z}-${row.A}-${row.RDM}-${row.RT}-${idx}`}
            />

            {/* Pagination controls */}

          </div>
        </div>
      )}
    </div>
  )
}
