import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Radiation, ArrowRight } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import { useLayout } from '../contexts/LayoutContext'
import type { Element, Nuclide, AtomicRadiiData, RadioactiveNuclideData, DisplayNuclide } from '../types'
import PeriodicTable from '../components/PeriodicTable'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import RadioactiveNuclideCard from '../components/RadioactiveNuclideCard'
import TabNavigation, { Tab } from '../components/TabNavigation'
import SortableTable, { TableColumn } from '../components/SortableTable'
import FilterPanel, { FilterConfig, FilterPreset } from '../components/FilterPanel'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'
import Tooltip from '../components/Tooltip'
import {
  getAllNuclidesByElement,
  getAtomicRadii,
  getAllElements,
  getAllNuclides,
  getAllDecays,
  getRadioactiveNuclides,
  getElementSymbolByZ,
  getNuclideBySymbol,
  getRadioactiveDecayData,
  getRadioactiveNuclideData,
  getUniqueDecayModes,
  getUniqueRadiationTypes,
  type RadioactiveDecay
} from '../services/queryService'
import { expandHalfLifeUnit } from '../utils/formatUtils'
import { RADIATION_TYPE_INFO } from '../constants/radiationTypes'

// Comprehensive decay mode information
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
function getDecayModeTooltip(mode: string): JSX.Element {
  const info = DECAY_MODE_INFO[mode]
  if (info) {
    return (
      <div>
        <div className="font-semibold mb-1">{mode}: {info.name}</div>
        <div className="mb-2">{info.description}</div>
        <a
          href={info.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-300 hover:text-blue-200 underline text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          Learn more →
        </a>
      </div>
    )
  }
  return <div>{mode} decay mode</div>
}

// Helper function to get radiation type tooltip content
function getRadiationTypeTooltip(type: string): JSX.Element {
  const info = RADIATION_TYPE_INFO[type]
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
          Learn more →
        </a>
        {(type.includes('K') || type.includes('L') || type.includes('M') || type.includes('N')) && (
          <div className="mt-2 pt-2 border-t border-gray-700 text-xs opacity-80">
            Shell designations: K (innermost), L, M, N (outer shells)
          </div>
        )}
      </div>
    )
  }
  return <div>{type} radiation</div>
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

export default function ShowElementData() {
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
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
  const [isotopes, setIsotopes] = useState<DisplayNuclide[]>([])
  const [selectedNuclide, setSelectedNuclide] = useState<Nuclide | null>(null)
  const [atomicRadii, setAtomicRadii] = useState<AtomicRadiiData | null>(null)
  const [requestedMissingNuclide, setRequestedMissingNuclide] = useState<{ E: string; A: number } | null>(null)
  const [radioactiveNuclideData, setRadioactiveNuclideData] = useState<RadioactiveNuclideData | null>(null)
  const [showLimitedDataNuclides, setShowLimitedDataNuclides] = useState(false) // Only show full NuclidesPlus data by default

  // Pagination state (URL-based)
  const elementsPageParam = Number(searchParams.get('elementsPage')) || 1
  const nuclidesPageParam = Number(searchParams.get('nuclidesPage')) || 1
  const decaysPageParam = Number(searchParams.get('decaysPage')) || 1
  const perPage = 50

  // Filter state (URL-stateful)
  const [elementsFilters, setElementsFilters] = useState<Record<string, any>>({})
  const [nuclidesFilters, setNuclidesFilters] = useState<Record<string, any>>({})
  const [decaysFilters, setDecaysFilters] = useState<Record<string, any>>({})

  // Collapse state (per tab, session-only)
  const [elementsCollapsed, setElementsCollapsed] = useState(true)
  const [nuclidesCollapsed, setNuclidesCollapsed] = useState(true)
  const [decaysCollapsed, setDecaysCollapsed] = useState(true)

  // Search state (per tab, transient - not in URL)
  const [elementsSearch, setElementsSearch] = useState('')
  const [nuclidesSearch, setNuclidesSearch] = useState('')
  const [decaysSearch, setDecaysSearch] = useState('')

  // Custom presets (stored in localStorage)
  const [customElementsPresets, setCustomElementsPresets] = useState<FilterPreset[]>([])
  const [customNuclidesPresets, setCustomNuclidesPresets] = useState<FilterPreset[]>([])
  const [customDecaysPresets, setCustomDecaysPresets] = useState<FilterPreset[]>([])

  // Expanded row state (per tab, session-only - NOT in URL)
  const [elementsExpandedRows, setElementsExpandedRows] = useState<Set<string | number>>(new Set())
  const [nuclidesExpandedRows, setNuclidesExpandedRows] = useState<Set<string | number>>(new Set())
  const [decaysExpandedRows, setDecaysExpandedRows] = useState<Set<string | number>>(new Set())

  // Get all elements from database (memoized to prevent recreating on every render)
  const allElements: Element[] = useMemo(() => {
    if (!db) return []
    return getAllElements(db)
  }, [db])

  // Get all nuclides from database (memoized)
  const allNuclides: Nuclide[] = useMemo(() => {
    if (!db) return []
    return getAllNuclides(db)
  }, [db])

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

  const element = allElements.find(el => el.E === selectedElement)

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
      result = result.filter(el => el.STPDensity != null && el.STPDensity >= elementsFilters.density.min)
    }
    if (elementsFilters.density?.max != null) {
      result = result.filter(el => el.STPDensity != null && el.STPDensity <= elementsFilters.density.max)
    }

    return result
  }, [allElements, elementsFilters])

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

    return result
  }, [allNuclides, nuclidesFilters, radioactiveNuclides])

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

    return result
  }, [allDecays, decaysFilters])

  // Pagination: Calculate total pages and paginated data
  const elementsTotalPages = Math.ceil(filteredElements.length / perPage)
  const nuclidesTotalPages = Math.ceil(filteredNuclides.length / perPage)
  const decaysTotalPages = Math.ceil(filteredDecays.length / perPage)

  const paginatedElements = useMemo(() => {
    const startIndex = (elementsPageParam - 1) * perPage
    return filteredElements.slice(startIndex, startIndex + perPage)
  }, [filteredElements, elementsPageParam, perPage])

  const paginatedNuclides = useMemo(() => {
    const startIndex = (nuclidesPageParam - 1) * perPage
    return filteredNuclides.slice(startIndex, startIndex + perPage)
  }, [filteredNuclides, nuclidesPageParam, perPage])

  const paginatedDecays = useMemo(() => {
    const startIndex = (decaysPageParam - 1) * perPage
    return filteredDecays.slice(startIndex, startIndex + perPage)
  }, [filteredDecays, decaysPageParam, perPage])

  // Pagination handlers that update URL
  const handleElementsPageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams)
    if (page === 1) {
      newParams.delete('elementsPage')
    } else {
      newParams.set('elementsPage', page.toString())
    }
    setSearchParams(newParams)
  }

  const handleNuclidesPageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams)
    if (page === 1) {
      newParams.delete('nuclidesPage')
    } else {
      newParams.set('nuclidesPage', page.toString())
    }
    setSearchParams(newParams)
  }

  const handleDecaysPageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams)
    if (page === 1) {
      newParams.delete('decaysPage')
    } else {
      newParams.set('decaysPage', page.toString())
    }
    setSearchParams(newParams)
  }

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
    const headers = elementsColumns.map(col => col.label)
    const rows = filteredElements.map(row =>
      elementsColumns.map(col => {
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
    const headers = nuclidesColumns.map(col => col.label)
    const rows = filteredNuclides.map(row =>
      nuclidesColumns.map(col => {
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
    const headers = decaysColumns.map(col => col.label)
    const rows = filteredDecays.map(row =>
      decaysColumns.map(col => {
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
    { id: 'integrated', label: 'Integrated' },
    { id: 'elements', label: 'Elements', count: filteredElements.length },
    { id: 'nuclides', label: 'Nuclides', count: filteredNuclides.length },
    { id: 'decays', label: 'Decays', count: filteredDecays.length }
  ]

  // Initialize from URL params on mount
  useEffect(() => {
    if (!db || allElements.length === 0) return

    const zParam = searchParams.get('Z')
    const aParam = searchParams.get('A')

    // Validate atomic number exists
    const validElement = zParam && allElements.find(el => el.Z === parseInt(zParam))

    if (validElement) {
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
      setSelectedElement('H')
      const newParams = new URLSearchParams(searchParams)
      newParams.set('Z', '1')
      setSearchParams(newParams, { replace: true })
    }
  }, [db, allElements, searchParams, setSearchParams, activeTab])

  // Fetch isotopes and atomic radii when element changes and check for isotope in URL
  useEffect(() => {
    if (db && selectedElement) {
      const currentElement = allElements.find(el => el.E === selectedElement)
      if (currentElement) {
        const allIsotopes = getAllNuclidesByElement(db, currentElement.Z)
        setIsotopes(allIsotopes)

        // Fetch atomic radii data
        const radiiData = getAtomicRadii(db, currentElement.Z)
        setAtomicRadii(radiiData)

        // Check if there's an A (mass number) param in URL
        const aParam = searchParams.get('A')
        if (aParam) {
          const massNumber = parseInt(aParam)
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
              // Auto-enable the limited-data toggle so the user can see this nuclide in the list
              setShowLimitedDataNuclides(true)
              setSelectedNuclide(null)
              const radioactiveData = getRadioactiveNuclideData(db, currentElement.E, massNumber)
              if (radioactiveData) {
                setRadioactiveNuclideData(radioactiveData)
                setRequestedMissingNuclide(null)
              } else {
                // Shouldn't happen since we found it in the list, but handle gracefully
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
  }, [db, selectedElement, allElements, searchParams])

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
    const clickedElement = allElements.find(el => el.E === elementSymbol)
    if (clickedElement) {
      setSelectedElement(elementSymbol)
      const newParams = new URLSearchParams(searchParams)
      newParams.set('tab', 'integrated')
      newParams.set('Z', clickedElement.Z.toString())
      newParams.delete('A') // Clear isotope selection
      setSearchParams(newParams)
    }
  }

  // Handler to update nuclide selection and URL
  const handleNuclideClick = (displayNuclide: DisplayNuclide) => {
    const newParams = new URLSearchParams(searchParams)

    if (displayNuclide.type === 'full') {
      // Full nuclide - set directly and update URL
      setSelectedNuclide(displayNuclide.data)
      newParams.set('Z', displayNuclide.data.Z.toString())
      newParams.set('A', displayNuclide.data.A.toString())
    } else {
      // RadioNuclides-only - update URL which will trigger the useEffect to load decay data
      newParams.set('Z', displayNuclide.data.Z.toString())
      newParams.set('A', displayNuclide.data.A.toString())
    }

    setSearchParams(newParams, { replace: true })
  }

  // Check if any limited-data (radioactive-only) nuclides exist
  const hasLimitedDataNuclides = useMemo(() => {
    return isotopes.some(displayNuclide => displayNuclide.type === 'radioactive-only')
  }, [isotopes])

  // Filter isotopes based on limited-data visibility toggle
  const visibleIsotopes = useMemo(() => {
    if (showLimitedDataNuclides) {
      return isotopes // Show all isotopes (both full and radioactive-only)
    }

    // Only show full nuclides from NuclidesPlus (hide radioactive-only entries)
    return isotopes.filter(displayNuclide => displayNuclide.type === 'full')
  }, [isotopes, showLimitedDataNuclides])

  // Filter configurations
  const elementsFilterConfigs: FilterConfig[] = [
    {
      key: 'period',
      label: 'Period',
      type: 'select',
      options: Array.from(new Set(allElements.map(el => el.Period)))
        .filter(p => p != null)
        .sort((a, b) => a - b)
        .map(p => ({ value: p, label: `Period ${p}` })),
      placeholder: 'All Periods'
    },
    {
      key: 'group',
      label: 'Group',
      type: 'select',
      options: Array.from(new Set(allElements.map(el => el.Group)))
        .filter(g => g != null)
        .sort((a, b) => a - b)
        .map(g => ({ value: g, label: `Group ${g}` })),
      placeholder: 'All Groups'
    },
    {
      key: 'magType',
      label: 'Magnetic Type',
      type: 'select',
      options: [
        { value: 'Ferromagnetic', label: 'Ferromagnetic' },
        { value: 'Paramagnetic', label: 'Paramagnetic' },
        { value: 'Diamagnetic', label: 'Diamagnetic' }
      ],
      placeholder: 'All Types'
    },
    {
      key: 'atomicWeight',
      label: 'Atomic Weight',
      type: 'range',
      min: 0,
      max: 300,
      step: 0.1
    },
    {
      key: 'melting',
      label: 'Melting Point (K)',
      type: 'range',
      min: 0,
      max: 4000,
      step: 10
    },
    {
      key: 'boiling',
      label: 'Boiling Point (K)',
      type: 'range',
      min: 0,
      max: 6000,
      step: 10
    },
    {
      key: 'density',
      label: 'Density (g/cm³)',
      type: 'range',
      min: 0,
      max: 25,
      step: 0.1
    }
  ]

  const elementsPresets: FilterPreset[] = [
    {
      id: 'ferromagnetic',
      label: 'Ferromagnetic Elements',
      filters: { magType: 'Ferromagnetic' }
    },
    {
      id: 'paramagnetic',
      label: 'Paramagnetic Elements',
      filters: { magType: 'Paramagnetic' }
    },
    {
      id: 'diamagnetic',
      label: 'Diamagnetic Elements',
      filters: { magType: 'Diamagnetic' }
    },
    {
      id: 'light-elements',
      label: 'Light Elements (Z ≤ 20)',
      filters: { atomicWeight: { max: 40 } }
    },
    {
      id: 'transition-metals',
      label: 'Transition Metals (Period 4, Groups 3-12)',
      filters: { period: 4, group: null }
    },
    {
      id: 'noble-gases',
      label: 'Noble Gases (Group 18)',
      filters: { group: 18 }
    }
  ]

  const nuclidesFilterConfigs: FilterConfig[] = [
    {
      key: 'element',
      label: 'Element',
      type: 'element-selector',
      availableElements: allElements
    },
    {
      key: 'zRange',
      label: 'Atomic Number (Z)',
      type: 'range',
      min: 1,
      max: 118,
      step: 1
    },
    {
      key: 'aRange',
      label: 'Mass Number (A)',
      type: 'range',
      min: 1,
      max: 300,
      step: 1
    },
    {
      key: 'bindingEnergy',
      label: 'Binding Energy (MeV)',
      type: 'range',
      min: 0,
      max: 2000,
      step: 1
    },
    {
      key: 'nBorF',
      label: 'Nuclear Type',
      type: 'select',
      options: [
        { value: 'b', label: 'Boson' },
        { value: 'f', label: 'Fermion' }
      ],
      placeholder: 'All Types'
    },
    {
      key: 'aBorF',
      label: 'Atomic Type',
      type: 'select',
      options: [
        { value: 'b', label: 'Boson' },
        { value: 'f', label: 'Fermion' }
      ],
      placeholder: 'All Types'
    },
    {
      key: 'onlyStable',
      label: 'Stable Only (log₁₀(Half-life) > 9)',
      type: 'toggle'
    },
    {
      key: 'onlyRadioactive',
      label: 'Radioactive Only',
      type: 'toggle'
    }
  ]

  const nuclidesPresets: FilterPreset[] = [
    {
      id: 'stable-nuclides',
      label: 'Stable Nuclides',
      filters: { onlyStable: true }
    },
    {
      id: 'radioactive-nuclides',
      label: 'Radioactive Nuclides',
      filters: { onlyRadioactive: true }
    },
    {
      id: 'nuclear-bosons',
      label: 'Nuclear Bosons',
      filters: { nBorF: 'b' }
    },
    {
      id: 'nuclear-fermions',
      label: 'Nuclear Fermions',
      filters: { nBorF: 'f' }
    },
    {
      id: 'light-nuclides',
      label: 'Light Nuclides (Z ≤ 20)',
      filters: { zRange: { max: 20 } }
    },
    {
      id: 'heavy-nuclides',
      label: 'Heavy Nuclides (Z > 82)',
      filters: { zRange: { min: 83 } }
    }
  ]

  const decaysFilterConfigs: FilterConfig[] = useMemo(() => {
    if (!db) return []

    return [
      {
        key: 'element',
        label: 'Element',
        type: 'element-selector',
        availableElements: allElements
      },
      {
        key: 'decayMode',
        label: 'Decay Mode',
        type: 'badge-selector',
        colorScheme: 'purple',
        options: getUniqueDecayModes(db).map(m => ({ value: m, label: m })),
        tooltipInfo: RADIATION_TYPE_INFO
      },
      {
        key: 'radiationType',
        label: 'Radiation Type',
        type: 'badge-selector',
        colorScheme: 'blue',
        options: getUniqueRadiationTypes(db).map(r => ({ value: r, label: r })),
        tooltipInfo: RADIATION_TYPE_INFO
      },
      {
        key: 'energy',
        label: 'Energy (keV)',
        type: 'range',
        min: 0,
        max: 10000,
        step: 1
      },
      {
        key: 'intensity',
        label: 'Intensity (%)',
        type: 'range',
        min: 0,
        max: 100,
        step: 0.1
      }
    ]
  }, [db, allElements])

  const decaysPresets: FilterPreset[] = [
    {
      id: 'alpha-decay',
      label: 'Alpha Decay',
      filters: { decayMode: ['A'] }
    },
    {
      id: 'beta-minus',
      label: 'Beta Minus Decay',
      filters: { decayMode: ['B-'] }
    },
    {
      id: 'beta-plus',
      label: 'Beta Plus Decay',
      filters: { decayMode: ['B+'] }
    },
    {
      id: 'gamma-radiation',
      label: 'Gamma Radiation',
      filters: { radiationType: ['G'] }
    },
    {
      id: 'high-energy',
      label: 'High Energy (> 1000 keV)',
      filters: { energy: { min: 1000 } }
    },
    {
      id: 'high-intensity',
      label: 'High Intensity (> 50%)',
      filters: { intensity: { min: 50 } }
    }
  ]

  // Elements table columns
  const elementsColumns: TableColumn<Element>[] = [
    { key: 'Z', label: 'Z', sortable: true },
    {
      key: 'E',
      label: 'Symbol',
      sortable: true,
      render: (val) => (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          {val}
        </span>
      )
    },
    { key: 'EName', label: 'Name', sortable: true },
    { key: 'Period', label: 'Period', sortable: true },
    { key: 'Group', label: 'Group', sortable: true },
    {
      key: 'AWeight',
      label: 'Atomic Weight',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(3) : '-'
    },
    {
      key: 'Melting',
      label: 'Melting (K)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'Boiling',
      label: 'Boiling (K)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'STPDensity',
      label: 'Density (g/cm³)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(3) : '-'
    }
  ]

  // Nuclides table columns
  const nuclidesColumns: TableColumn<Nuclide>[] = [
    {
      key: 'E',
      label: 'Element',
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
      label: 'Binding Energy (MeV)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(3) : '-'
    },
    {
      key: 'AMU',
      label: 'Mass (amu)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(6) : '-'
    },
    {
      key: 'nBorF',
      label: 'Nuclear',
      sortable: true,
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          val === 'b'
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
            : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
        }`}>
          {val === 'b' ? 'Boson' : 'Fermion'}
        </span>
      )
    },
    {
      key: 'aBorF',
      label: 'Atomic',
      sortable: true,
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          val === 'b'
            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
            : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
        }`}>
          {val === 'b' ? 'Boson' : 'Fermion'}
        </span>
      )
    },
    {
      key: 'logHalfLife',
      label: 'log₁₀(Half-life)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'stability',
      label: 'Stability',
      sortable: false,
      render: (_, row) => {
        const isStable = typeof row.logHalfLife === 'number' && row.logHalfLife > 9
        const isRadioactive = radioactiveNuclides.has(`${row.Z}-${row.A}`)

        return (
          <div className="flex items-center gap-2">
            {isStable ? (
              <span className="px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                Stable
              </span>
            ) : (
              <span className="px-2 py-1 rounded-full text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                Unstable
              </span>
            )}
            {isRadioactive && (
              <span title="Radioactive">
                <Radiation className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </span>
            )}
          </div>
        )
      }
    }
  ]

  // Decays table columns
  const decaysColumns: TableColumn<RadioactiveDecay>[] = [
    {
      key: 'E',
      label: 'Element',
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
      label: 'Decay Mode',
      sortable: true,
      render: (val) => val ? (
        <Tooltip content={getDecayModeTooltip(val)}>
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
            {val}
          </span>
        </Tooltip>
      ) : '-'
    },
    {
      key: 'RT',
      label: 'Radiation Type',
      sortable: true,
      render: (val) => val ? (
        <Tooltip content={getRadiationTypeTooltip(val)}>
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            {val}
          </span>
        </Tooltip>
      ) : '-'
    },
    {
      key: 'halfLife',
      label: 'Half-life',
      sortable: true,
      render: (val, row) => {
        if (val == null) return '-'
        const units = expandHalfLifeUnit(row.Units)
        return `${Number(val).toExponential(2)} ${units}`
      }
    },
    {
      key: 'DEKeV',
      label: 'Energy (keV)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'RI',
      label: 'Intensity (%)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    }
  ]

  if (dbLoading) {
    return <DatabaseLoadingCard downloadProgress={downloadProgress} />
  }

  if (dbError) {
    return <DatabaseErrorCard error={dbError} />
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page title bar - collapses upward when tabs stick on mobile */}
      <div
        className={`mb-6 overflow-hidden transition-all duration-300 ease-in-out ${
          isTabsStuck ? 'max-h-0 opacity-0 -translate-y-4 mb-0' : 'max-h-32 opacity-100 translate-y-0'
        }`}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Show Element Data</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View detailed chemical, physical, and nuclear properties across multiple data views
        </p>
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
            onElementClick={handleElementClick}
          />

          {element && (
            <div className="space-y-6 mt-6">
              <div className="card p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{element.EName} ({element.E})</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Atomic Number: {element.Z}</p>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Periodic Table</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Atomic Number (Z):</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Z}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Period:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Period}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Group:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Group}</dd>
                      </div>
                      {typeof element.AWeight === 'number' && !isNaN(element.AWeight) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Atomic Weight:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.AWeight.toFixed(3)}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Atomic Properties</h3>
                    <dl className="space-y-2 text-sm">
                      {element.Valence !== null && element.Valence !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Valence:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Valence}</dd>
                        </div>
                      )}
                      {element.Negativity !== null && element.Negativity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Electronegativity:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Negativity}</dd>
                        </div>
                      )}
                      {element.Affinity !== null && element.Affinity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Electron Affinity:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Affinity} kJ/mol</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Ionization</h3>
                    <dl className="space-y-2 text-sm">
                      {element.MaxIonNum !== null && element.MaxIonNum !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Max Ion Number:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonNum}</dd>
                        </div>
                      )}
                      {typeof element.MaxIonization === 'number' && !isNaN(element.MaxIonization) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Max Ionization:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonization.toFixed(1)} kJ/mol</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Thermal Properties</h3>
                  <dl className="space-y-2 text-sm">
                    {typeof element.Melting === 'number' && !isNaN(element.Melting) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Melting Point:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Melting.toFixed(2)} K</dd>
                      </div>
                    )}
                    {typeof element.Boiling === 'number' && !isNaN(element.Boiling) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Boiling Point:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Boiling.toFixed(2)} K</dd>
                      </div>
                    )}
                    {typeof element.SpecHeat === 'number' && !isNaN(element.SpecHeat) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Specific Heat:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.SpecHeat.toFixed(2)} J/(g·K)</dd>
                      </div>
                    )}
                    {typeof element.ThermConduct === 'number' && !isNaN(element.ThermConduct) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Thermal Conductivity:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ThermConduct.toFixed(2)} W/(m·K)</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div className="card p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Physical Properties</h3>
                  <dl className="space-y-2 text-sm">
                    {typeof element.STPDensity === 'number' && !isNaN(element.STPDensity) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Density (STP):</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.STPDensity.toFixed(3)} g/cm³</dd>
                      </div>
                    )}
                    {typeof element.MolarVolume === 'number' && !isNaN(element.MolarVolume) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Molar Volume:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MolarVolume.toFixed(2)} cm³/mol</dd>
                      </div>
                    )}
                    {typeof element.ElectConduct === 'number' && !isNaN(element.ElectConduct) && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Electrical Conductivity:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ElectConduct.toFixed(2)} MS/m</dd>
                      </div>
                    )}
                    {element.MagType && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Magnetic Type:</dt>
                        <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MagType}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {atomicRadii && (
                  <div className="card p-6">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Atomic Radii (pm)</h3>
                    <dl className="space-y-2 text-sm">
                      {atomicRadii.empirical !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Empirical:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.empirical} pm</dd>
                        </div>
                      )}
                      {atomicRadii.calculated !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Calculated:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.calculated} pm</dd>
                        </div>
                      )}
                      {atomicRadii.vanDerWaals !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Van der Waals:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.vanDerWaals} pm</dd>
                        </div>
                      )}
                      {atomicRadii.covalent !== null && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Covalent:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{atomicRadii.covalent} pm</dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                      <strong>Empirical:</strong> Measured • <strong>Calculated:</strong> Theoretical<br />
                      <strong>Van der Waals:</strong> Non-bonded • <strong>Covalent:</strong> Bonded atoms
                    </div>
                  </div>
                )}
              </div>

              {/* Nuclides Section */}
              {isotopes.length > 0 ? (
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Nuclides ({visibleIsotopes.length} of {isotopes.length} shown)
                    </h3>

                    {/* Toggle for limited-data nuclides (RadioNuclides-only entries) */}
                    <label className={`flex items-center gap-3 ${hasLimitedDataNuclides ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Include limited-data nuclides
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={showLimitedDataNuclides && hasLimitedDataNuclides}
                        disabled={!hasLimitedDataNuclides}
                        onClick={() => hasLimitedDataNuclides && setShowLimitedDataNuclides(!showLimitedDataNuclides)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          hasLimitedDataNuclides ? 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800' : ''
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

                      // For radioactive-only, format half-life
                      const halfLifeStr = !isFull && displayNuclide.data.halfLife !== null && displayNuclide.data.Units !== null
                        ? displayNuclide.data.halfLife >= 10000
                          ? `${displayNuclide.data.halfLife.toExponential(1)}${displayNuclide.data.Units}`
                          : `${displayNuclide.data.halfLife}${displayNuclide.data.Units}`
                        : null

                      return (
                        <Tooltip
                          key={`${E}-${A}-${idx}`}
                          content={!isFull ? "Limited data - radioactive decay only" : undefined}
                        >
                          <button
                            onClick={() => handleNuclideClick(displayNuclide)}
                            className={`
                              p-3 rounded-lg border-2 transition-all duration-150 w-full h-full min-h-[100px]
                              ${isSelected
                                ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-400 shadow-md'
                                : isFull
                                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400'
                                  : 'bg-amber-50 dark:bg-amber-900/10 text-gray-900 dark:text-gray-100 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/20 hover:border-amber-400'
                              }
                            `}
                          >
                            <div className="text-center">
                              <div className="text-lg font-bold">{E}-{A}</div>
                              <div className="text-xs opacity-75">Z={Z}</div>
                              <div className="mt-1 flex flex-wrap gap-1 justify-center">
                                {displayNuclide.type === 'full' ? (
                                  <>
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                      displayNuclide.data.nBorF === 'b'
                                        ? isSelected ? 'bg-blue-600 text-blue-100' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                        : isSelected ? 'bg-orange-600 text-orange-100' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                                    }`}>
                                      {displayNuclide.data.nBorF === 'b' ? 'B' : 'F'}
                                    </span>
                                    {isStable && (
                                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                        isSelected ? 'bg-green-600 text-green-100' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                      }`}>
                                        Stable
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className={`px-1.5 py-0.5 rounded-full text-xs flex items-center gap-0.5 ${
                                      isSelected ? 'bg-amber-600 text-amber-100' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                    }`}>
                                      <Radiation className="w-2.5 h-2.5" />
                                      {displayNuclide.data.RDM}
                                    </span>
                                    {halfLifeStr && (
                                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                        isSelected ? 'bg-gray-600 text-gray-100' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                      }`}>
                                        {halfLifeStr}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        </Tooltip>
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
                        Nuclide Not Available
                      </h3>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">
                        The nuclide <strong>{requestedMissingNuclide.E}-{requestedMissingNuclide.A}</strong> is not available in either the stable nuclides or radioactive decay databases.
                        This isotope may be extremely short-lived or outside the range of documented nuclides.
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Available nuclides for {element?.EName} are shown above. Select one to view its detailed properties.
                      </p>
                    </div>
                  )}
                </div>
              ) : element ? (
                <div className="card p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800">
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
                    No Nuclides Available
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
                    No nuclides for <strong>{element.EName} ({element.E})</strong> are available in the database.
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    This element may not be included in the current dataset, which focuses on elements relevant to Low Energy Nuclear Reaction (LENR) research.
                  </p>
                </div>
              ) : null}
            </div>
          )}
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
            searchPlaceholder="Search elements by symbol or name..."
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
              data={paginatedElements}
              columns={elementsColumns}
              searchTerm={elementsSearch}
              expandedRows={elementsExpandedRows}
              onExpandedRowsChange={setElementsExpandedRows}
              title="Elements Table"
              description="Browse and search all chemical elements. Click any row to view detailed properties in the Integrated tab."
              renderExpandedContent={(element) => (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                      Chemical Properties
                    </h4>
                    <dl className="space-y-2 text-sm">
                      {element.Valence !== null && element.Valence !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Valence:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Valence}</dd>
                        </div>
                      )}
                      {element.Negativity !== null && element.Negativity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Electronegativity:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Negativity}</dd>
                        </div>
                      )}
                      {element.Affinity !== null && element.Affinity !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Electron Affinity:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Affinity} kJ/mol</dd>
                        </div>
                      )}
                      {element.MaxIonNum !== null && element.MaxIonNum !== undefined && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Max Ion Number:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonNum}</dd>
                        </div>
                      )}
                      <div className="flex justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <dt className="text-gray-600 dark:text-gray-400">View Details:</dt>
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
                      Thermal Properties
                    </h4>
                    <dl className="space-y-2 text-sm">
                      {typeof element.SpecHeat === 'number' && !isNaN(element.SpecHeat) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Specific Heat:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.SpecHeat.toFixed(2)} J/(g·K)</dd>
                        </div>
                      )}
                      {typeof element.ThermConduct === 'number' && !isNaN(element.ThermConduct) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Thermal Conductivity:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ThermConduct.toFixed(2)} W/(m·K)</dd>
                        </div>
                      )}
                      {typeof element.MolarVolume === 'number' && !isNaN(element.MolarVolume) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Molar Volume:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MolarVolume.toFixed(2)} cm³/mol</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                      Other Properties
                    </h4>
                    <dl className="space-y-2 text-sm">
                      {typeof element.ElectConduct === 'number' && !isNaN(element.ElectConduct) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Electrical Conductivity:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.ElectConduct.toFixed(2)} MS/m</dd>
                        </div>
                      )}
                      {element.MagType && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Magnetic Type:</dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MagType}</dd>
                        </div>
                      )}
                      {typeof element.MaxIonization === 'number' && !isNaN(element.MaxIonization) && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Max Ionization:</dt>
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
            {elementsTotalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {elementsPageParam} of {elementsTotalPages} ({filteredElements.length} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleElementsPageChange(elementsPageParam - 1)}
                    disabled={elementsPageParam === 1}
                    className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handleElementsPageChange(elementsPageParam + 1)}
                    disabled={elementsPageParam >= elementsTotalPages}
                    className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
            searchPlaceholder="Search nuclides by element name, symbol, Z, or A..."
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
              data={paginatedNuclides}
              columns={nuclidesColumns}
              searchTerm={nuclidesSearch}
              expandedRows={nuclidesExpandedRows}
              onExpandedRowsChange={setNuclidesExpandedRows}
              title="Nuclides Table"
              description="Browse all nuclear isotopes with binding energies, boson/fermion classifications, and stability indicators. Click any row to view detailed properties in the Integrated tab."
              renderExpandedContent={(nuclide) => {
                const hasAbundance = (nuclide.pcaNCrust && nuclide.pcaNCrust > 0) || (nuclide.ppmNSolar && nuclide.ppmNSolar > 0)
                const hasMagneticData = nuclide.SP || nuclide.MD || nuclide.Inova_MHz

                // Format status type
                const formatStatus = (sus?: string) => {
                  if (!sus) return 'Unknown'
                  if (sus === 'SPN') return 'Stable Primordial'
                  if (sus === 'SYN') return 'Synthetic'
                  if (sus === 'UPN') return 'Unstable Primordial'
                  return sus
                }

                return (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Natural Occurrence */}
                    {hasAbundance && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                          Natural Occurrence
                        </h4>
                        <dl className="space-y-2 text-sm">
                          {nuclide.pcaNCrust !== null && nuclide.pcaNCrust !== undefined && nuclide.pcaNCrust > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">Earth's Crust:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {nuclide.pcaNCrust.toFixed(2)}%
                                {nuclide.ppmNCrust && ` (${nuclide.ppmNCrust.toFixed(1)} ppm)`}
                              </dd>
                            </div>
                          )}
                          {nuclide.ppmNSolar !== null && nuclide.ppmNSolar !== undefined && nuclide.ppmNSolar > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">Solar System:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">
                                {nuclide.ppmNSolar.toFixed(1)} ppm
                              </dd>
                            </div>
                          )}
                          {nuclide.SUS && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">Classification:</dt>
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
                          Nuclear Properties
                        </h4>
                        <dl className="space-y-2 text-sm">
                          {nuclide.SP && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">Nuclear Spin:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.SP}</dd>
                            </div>
                          )}
                          {nuclide.MD && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">Magnetic Moment:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.MD} μₙ</dd>
                            </div>
                          )}
                          {nuclide.Inova_MHz !== null && nuclide.Inova_MHz !== undefined && nuclide.Inova_MHz > 0 && (
                            <div className="flex justify-between">
                              <dt className="text-gray-600 dark:text-gray-400">NMR Frequency:</dt>
                              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.Inova_MHz.toFixed(3)} MHz</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {/* Additional Properties */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                        Additional Properties
                      </h4>
                      <dl className="space-y-2 text-sm">
                        {nuclide.BE !== null && nuclide.BE !== undefined && nuclide.A > 0 && (
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-400">BE per Nucleon:</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">{(Number(nuclide.BE) / nuclide.A).toFixed(3)} MeV</dd>
                          </div>
                        )}
                        {nuclide.RDM && (
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-400">Primary Decay:</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.RDM}</dd>
                          </div>
                        )}
                        {nuclide.DEMeV !== null && nuclide.DEMeV !== undefined && nuclide.DEMeV > 0 && (
                          <div className="flex justify-between">
                            <dt className="text-gray-600 dark:text-gray-400">Decay Energy:</dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.DEMeV.toFixed(3)} MeV</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">View Details:</dt>
                          <dd>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const newParams = new URLSearchParams(searchParams)
                                newParams.set('tab', 'integrated')
                                newParams.set('Z', nuclide.Z.toString())
                                newParams.set('A', nuclide.A.toString())
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
            {nuclidesTotalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {nuclidesPageParam} of {nuclidesTotalPages} ({filteredNuclides.length} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleNuclidesPageChange(nuclidesPageParam - 1)}
                    disabled={nuclidesPageParam === 1}
                    className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handleNuclidesPageChange(nuclidesPageParam + 1)}
                    disabled={nuclidesPageParam >= nuclidesTotalPages}
                    className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
            searchPlaceholder="Search decays by element, decay mode, or radiation type..."
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
              data={paginatedDecays}
              columns={decaysColumns}
              searchTerm={decaysSearch}
              expandedRows={decaysExpandedRows}
              onExpandedRowsChange={setDecaysExpandedRows}
              title="Radioactive Decays Table"
              description="Browse radioactive decay modes, half-lives, energies, and intensities for all unstable isotopes. Click any row to view the parent nuclide in the Integrated tab."
              renderExpandedContent={(decay) => {
                // Calculate daughter nuclide
                const daughter = getDaughterNuclide(decay.Z, decay.A, decay.E, decay.RDM || '')
                const hasDaughter = daughter !== null && db
                const daughterE = hasDaughter ? (daughter!.E || getElementSymbolByZ(db!, daughter!.Z)) : null

                // Get daughter's properties from NuclidesPlus if it exists
                const daughterNuclide = hasDaughter && daughterE && db ? getNuclideBySymbol(db, daughterE, daughter!.A) : null
                const daughterIsStable = daughterNuclide && typeof daughterNuclide.logHalfLife === 'number' && daughterNuclide.logHalfLife > 9

                // Get daughter's primary decay if radioactive
                const daughterDecay = !daughterIsStable && db && daughterE && daughter && daughterNuclide ?
                  getRadioactiveDecayData(db, daughter.Z, daughter.A).find(d => d.decayMode === daughterNuclide.RDM) : null

                // Calculate granddaughter if daughter is also radioactive
                const granddaughter = daughterDecay && daughterE && daughter ?
                  getDaughterNuclide(daughter.Z, daughter.A, daughterE, daughterDecay.decayMode) : null
                const granddaughterE = granddaughter && db ? getElementSymbolByZ(db, granddaughter.Z) : null

                // Get all decay modes for this parent nuclide (for showing alternatives)
                const allDecayModes = db ? getRadioactiveDecayData(db, decay.Z, decay.A) : []
                const uniqueDecayModes = allDecayModes.reduce((acc, d) => {
                  const key = d.decayMode
                  if (!acc.some(x => x.decayMode === key)) {
                    acc.push(d)
                  }
                  return acc
                }, [] as typeof allDecayModes)

                return (
                  <div className="space-y-6">
                    {/* Decay Chain Visualization */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                        Decay Chain
                      </h4>
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Parent Nuclide */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const newParams = new URLSearchParams(searchParams)
                            newParams.set('tab', 'integrated')
                            newParams.set('Z', decay.Z.toString())
                            newParams.set('A', decay.A.toString())
                            setSearchParams(newParams)
                          }}
                          className="p-3 border-2 border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                          <div className="text-center">
                            <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{decay.E}-{decay.A}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Parent</div>
                            {decay.halfLife && decay.Units && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                t½ = {Number(decay.halfLife) >= 1000 ? Number(decay.halfLife).toExponential(1) : Number(decay.halfLife).toFixed(2)} {expandHalfLifeUnit(decay.Units)}
                              </div>
                            )}
                          </div>
                        </button>

                        {/* Decay Arrow */}
                        {hasDaughter && (
                          <>
                            <div className="flex flex-col items-center text-center px-2">
                              <ArrowRight className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                              <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-1">{decay.RDM}</div>
                              {decay.RT && <div className="text-xs text-gray-500 dark:text-gray-400">{decay.RT}</div>}
                              {decay.DEKeV && <div className="text-xs text-gray-500 dark:text-gray-400">{(decay.DEKeV / 1000).toFixed(1)} MeV</div>}
                            </div>

                            {/* Daughter Nuclide */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const newParams = new URLSearchParams(searchParams)
                                newParams.set('tab', 'integrated')
                                newParams.set('Z', daughter!.Z.toString())
                                newParams.set('A', daughter!.A.toString())
                                setSearchParams(newParams)
                              }}
                              className={`p-3 border-2 rounded-lg transition-colors ${
                                daughterIsStable
                                  ? 'border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20'
                                  : 'border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                              }`}
                            >
                              <div className="text-center">
                                <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{daughterE}-{daughter!.A}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">Daughter</div>
                                {daughterIsStable ? (
                                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">Stable</div>
                                ) : daughterDecay ? (
                                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                    t½ = {daughterDecay.halfLife && daughterDecay.halfLifeUnits ?
                                      `${Number(daughterDecay.halfLife) >= 1000 ? Number(daughterDecay.halfLife).toExponential(1) : Number(daughterDecay.halfLife).toFixed(2)} ${expandHalfLifeUnit(daughterDecay.halfLifeUnits)}`
                                      : 'Radioactive'}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">—</div>
                                )}
                              </div>
                            </button>

                            {/* Granddaughter (if daughter is also radioactive) */}
                            {granddaughter && granddaughterE && (
                              <>
                                <div className="flex flex-col items-center text-center px-2">
                                  <ArrowRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-1">{daughterDecay?.decayMode}</div>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const newParams = new URLSearchParams(searchParams)
                                    newParams.set('tab', 'integrated')
                                    newParams.set('Z', granddaughter.Z.toString())
                                    newParams.set('A', granddaughter.A.toString())
                                    setSearchParams(newParams)
                                  }}
                                  className="p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors opacity-75"
                                >
                                  <div className="text-center">
                                    <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{granddaughterE}-{granddaughter.A}</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Granddaughter</div>
                                  </div>
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Alternative Decay Modes (if multiple paths exist) */}
                    {uniqueDecayModes.length > 1 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
                          Alternative Decay Modes for {decay.E}-{decay.A}
                        </h4>
                        <div className="space-y-2">
                          {uniqueDecayModes.map((mode, idx) => {
                            const altDaughter = getDaughterNuclide(decay.Z, decay.A, decay.E, mode.decayMode)
                            const altDaughterE = altDaughter && db ? getElementSymbolByZ(db, altDaughter.Z) : null

                            return (
                              <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-gray-50 dark:bg-gray-800">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                                    {mode.decayMode}
                                  </span>
                                  <span className="text-gray-600 dark:text-gray-400">→</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {altDaughterE}-{altDaughter?.A || '?'}
                                  </span>
                                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                    {mode.radiationType}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                  {mode.intensity && <span>{mode.intensity.toFixed(1)}%</span>}
                                  {mode.energyKeV && <span>{(mode.energyKeV / 1000).toFixed(2)} MeV</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }}
              getRowKey={(row, idx) => `${row.Z}-${row.A}-${row.RDM}-${row.RT}-${idx}`}
            />

            {/* Pagination controls */}
            {decaysTotalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Page {decaysPageParam} of {decaysTotalPages} ({filteredDecays.length} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecaysPageChange(decaysPageParam - 1)}
                    disabled={decaysPageParam === 1}
                    className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handleDecaysPageChange(decaysPageParam + 1)}
                    disabled={decaysPageParam >= decaysTotalPages}
                    className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
