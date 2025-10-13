import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Radiation } from 'lucide-react'
import { useDatabase } from '../contexts/DatabaseContext'
import type { Element, Nuclide, AtomicRadiiData } from '../types'
import PeriodicTable from '../components/PeriodicTable'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import TabNavigation, { Tab } from '../components/TabNavigation'
import SortableTable, { TableColumn } from '../components/SortableTable'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'
import {
  getNuclidesByElement,
  getAtomicRadii,
  getAllElements,
  getAllNuclides,
  getAllDecays,
  getRadioactiveNuclides,
  type RadioactiveDecay
} from '../services/queryService'

export default function ShowElementData() {
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab state
  const activeTabParam = searchParams.get('tab') || 'integrated'
  const [activeTab, setActiveTab] = useState(activeTabParam)

  // Integrated tab state
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [isotopes, setIsotopes] = useState<Nuclide[]>([])
  const [selectedNuclide, setSelectedNuclide] = useState<Nuclide | null>(null)
  const [atomicRadii, setAtomicRadii] = useState<AtomicRadiiData | null>(null)
  const [requestedMissingNuclide, setRequestedMissingNuclide] = useState<{ E: string; A: number } | null>(null)

  // Decays tab pagination state
  const [decaysPage, setDecaysPage] = useState(0)
  const decaysPerPage = 50

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

  // Get all decays with pagination (memoized)
  const allDecaysData = useMemo(() => {
    if (!db) return { decays: [], totalCount: 0 }
    return getAllDecays(db, {
      limit: decaysPerPage,
      offset: decaysPage * decaysPerPage,
      sortBy: 'Z',
      sortDirection: 'asc'
    })
  }, [db, decaysPage])

  // Get radioactive nuclides for batch checking (memoized)
  const radioactiveNuclides = useMemo(() => {
    if (!db || allNuclides.length === 0) return new Set<string>()
    return getRadioactiveNuclides(db, allNuclides)
  }, [db, allNuclides])

  const element = allElements.find(el => el.E === selectedElement)

  // Define tabs with counts
  const tabs: Tab[] = [
    { id: 'integrated', label: 'Integrated' },
    { id: 'elements', label: 'Elements', count: allElements.length },
    { id: 'nuclides', label: 'Nuclides', count: allNuclides.length },
    { id: 'decays', label: 'Decays', count: allDecaysData.totalCount }
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
        const elementIsotopes = getNuclidesByElement(db, currentElement.Z)
        setIsotopes(elementIsotopes)

        // Fetch atomic radii data
        const radiiData = getAtomicRadii(db, currentElement.Z)
        setAtomicRadii(radiiData)

        // Check if there's an A (mass number) param in URL
        const aParam = searchParams.get('A')
        if (aParam) {
          const massNumber = parseInt(aParam)
          const validIsotope = elementIsotopes.find(iso => iso.A === massNumber)
          if (validIsotope) {
            setSelectedNuclide(validIsotope)
            setRequestedMissingNuclide(null)
          } else {
            setSelectedNuclide(null)
            // Track the requested but missing nuclide
            setRequestedMissingNuclide({ E: currentElement.E, A: massNumber })
          }
        } else {
          setSelectedNuclide(null) // Reset nuclide selection when element changes
          setRequestedMissingNuclide(null)
        }
      }
    } else {
      setIsotopes([])
      setSelectedNuclide(null)
      setAtomicRadii(null)
      setRequestedMissingNuclide(null)
    }
  }, [db, selectedElement, allElements, searchParams])

  // Sync activeTab with URL param
  useEffect(() => {
    const tabParam = searchParams.get('tab') || 'integrated'
    if (tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams, activeTab])

  // Handler to update element selection and URL
  const handleElementClick = (elementSymbol: string) => {
    const clickedElement = allElements.find(el => el.E === elementSymbol)
    if (clickedElement) {
      setSelectedElement(elementSymbol)
      const newParams = new URLSearchParams(searchParams)
      newParams.set('tab', 'integrated')
      newParams.set('Z', clickedElement.Z.toString())
      newParams.delete('A') // Clear isotope selection
      setSearchParams(newParams, { replace: true })
    }
  }

  // Handler to update nuclide selection and URL
  const handleNuclideClick = (nuclide: Nuclide) => {
    setSelectedNuclide(nuclide)
    const newParams = new URLSearchParams(searchParams)
    newParams.set('Z', nuclide.Z.toString())
    newParams.set('A', nuclide.A.toString())
    setSearchParams(newParams, { replace: true })
  }

  // Elements table columns
  const elementsColumns: TableColumn<Element>[] = [
    { key: 'Z', label: 'Z', sortable: true },
    { key: 'E', label: 'Symbol', sortable: true },
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
    { key: 'E', label: 'Element', sortable: true },
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
      render: (val) => val === 'b' ? 'Boson' : 'Fermion'
    },
    {
      key: 'aBorF',
      label: 'Atomic',
      sortable: true,
      render: (val) => val === 'b' ? 'Boson' : 'Fermion'
    },
    {
      key: 'LHL',
      label: 'log₁₀(Half-life)',
      sortable: true,
      render: (val) => val != null ? Number(val).toFixed(2) : '-'
    },
    {
      key: 'stability',
      label: 'Stability',
      sortable: false,
      render: (_, row) => {
        const isStable = typeof row.LHL === 'number' && row.LHL > 9
        const isRadioactive = radioactiveNuclides.has(`${row.Z}-${row.A}`)

        return (
          <div className="flex items-center gap-2">
            {isStable ? (
              <span className="px-2 py-1 rounded text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                Stable
              </span>
            ) : (
              <span className="px-2 py-1 rounded text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
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
    { key: 'E', label: 'Element', sortable: true },
    { key: 'Z', label: 'Z', sortable: true },
    { key: 'A', label: 'A', sortable: true },
    { key: 'RDM', label: 'Decay Mode', sortable: true },
    { key: 'RT', label: 'Radiation Type', sortable: true },
    {
      key: 'HL',
      label: 'Half-life',
      sortable: true,
      render: (val, row) => {
        if (val == null) return '-'
        const units = row.Units || ''
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Show Element Data</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View detailed chemical, physical, and nuclear properties across multiple data views
        </p>
      </div>

      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Nuclides ({isotopes.length} available)
                  </h3>

                  {/* Isotope selection cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                    {isotopes.map(nuclide => {
                      const isSelected = selectedNuclide?.id === nuclide.id
                      const isStable = typeof nuclide.LHL === 'number' && nuclide.LHL > 9

                      return (
                        <button
                          key={nuclide.id}
                          onClick={() => handleNuclideClick(nuclide)}
                          className={`
                            p-3 rounded-lg border-2 transition-all duration-150
                            ${isSelected
                              ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-400 shadow-md'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400'
                            }
                          `}
                        >
                          <div className="text-center">
                            <div className="text-lg font-bold">{nuclide.E}-{nuclide.A}</div>
                            <div className="text-xs opacity-75">Z={nuclide.Z}</div>
                            <div className="mt-1 flex flex-wrap gap-1 justify-center">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                nuclide.nBorF === 'b'
                                  ? isSelected ? 'bg-blue-600 text-blue-100' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                  : isSelected ? 'bg-orange-600 text-orange-100' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                              }`}>
                                {nuclide.nBorF === 'b' ? 'B' : 'F'}
                              </span>
                              {isStable && (
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  isSelected ? 'bg-green-600 text-green-100' : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                                }`}>
                                  Stable
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Selected nuclide details */}
                  {selectedNuclide && (
                    <div className="mt-4">
                      <NuclideDetailsCard nuclide={selectedNuclide} />
                    </div>
                  )}

                  {/* Missing nuclide message */}
                  {!selectedNuclide && requestedMissingNuclide && (
                    <div className="mt-4 p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-lg">
                      <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
                        Nuclide Not Available
                      </h3>
                      <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">
                        The nuclide <strong>{requestedMissingNuclide.E}-{requestedMissingNuclide.A}</strong> is not available in the database.
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
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Elements Table
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Browse and search all chemical elements. Click any row to view detailed properties in the Integrated tab.
          </p>
          <SortableTable
            data={allElements}
            columns={elementsColumns}
            onRowClick={(row) => handleElementClick(row.E)}
            searchPlaceholder="Search elements by symbol or name..."
            exportFileName="elements"
          />
        </div>
      )}

      {/* Nuclides Tab */}
      {activeTab === 'nuclides' && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Nuclides Table
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Browse all nuclear isotopes with binding energies, boson/fermion classifications, and stability indicators.
            Click any row to view detailed properties in the Integrated tab.
          </p>
          <SortableTable
            data={allNuclides}
            columns={nuclidesColumns}
            onRowClick={(row) => {
              const newParams = new URLSearchParams(searchParams)
              newParams.set('tab', 'integrated')
              newParams.set('Z', row.Z.toString())
              newParams.set('A', row.A.toString())
              setSearchParams(newParams, { replace: true })
            }}
            searchPlaceholder="Search nuclides by element symbol, Z, or A..."
            exportFileName="nuclides"
          />
        </div>
      )}

      {/* Decays Tab */}
      {activeTab === 'decays' && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Radioactive Decays Table
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Browse radioactive decay modes, half-lives, energies, and intensities for all unstable isotopes.
            Click any row to view the parent nuclide in the Integrated tab.
          </p>

          <SortableTable
            data={allDecaysData.decays}
            columns={decaysColumns}
            onRowClick={(row) => {
              const newParams = new URLSearchParams(searchParams)
              newParams.set('tab', 'integrated')
              newParams.set('Z', row.Z.toString())
              newParams.set('A', row.A.toString())
              setSearchParams(newParams, { replace: true })
            }}
            searchPlaceholder="Search decays by element, decay mode, or radiation type..."
            exportFileName="decays"
          />

          {/* Pagination controls */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {decaysPage + 1} of {Math.ceil(allDecaysData.totalCount / decaysPerPage)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDecaysPage(Math.max(0, decaysPage - 1))}
                disabled={decaysPage === 0}
                className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setDecaysPage(decaysPage + 1)}
                disabled={(decaysPage + 1) * decaysPerPage >= allDecaysData.totalCount}
                className="btn btn-secondary px-4 py-2 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
