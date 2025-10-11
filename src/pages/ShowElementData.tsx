import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDatabase } from '../contexts/DatabaseContext'
import type { Element, Nuclide, AtomicRadiiData } from '../types'
import PeriodicTable from '../components/PeriodicTable'
import NuclideDetailsCard from '../components/NuclideDetailsCard'
import { getNuclidesByElement, getAtomicRadii } from '../services/queryService'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import DatabaseErrorCard from '../components/DatabaseErrorCard'

export default function ShowElementData() {
  const { db, isLoading: dbLoading, error: dbError, downloadProgress } = useDatabase()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [isotopes, setIsotopes] = useState<Nuclide[]>([])
  const [selectedNuclide, setSelectedNuclide] = useState<Nuclide | null>(null)
  const [atomicRadii, setAtomicRadii] = useState<AtomicRadiiData | null>(null)

  // Get all elements from database (memoized to prevent recreating on every render)
  const allElements: Element[] = useMemo(() => {
    if (!db) return []
    const result = db.exec('SELECT * FROM ElementPropertiesPlus ORDER BY Z')
    if (result.length === 0) return []

    // Column name mapping from database to TypeScript interface
    const columnMap: { [key: string]: string } = {
      'P': 'Period',
      'G': 'Group',
      'MolarVol': 'MolarVolume',
      'Val': 'Valence',
      'MxInum': 'MaxIonNum',
      'MxInize': 'MaxIonization',
      'ElectG': 'ElectConduct',
      'ThermG': 'ThermConduct'
    }

    const columns = result[0].columns
    return result[0].values.map(row => {
      const element: any = {}
      columns.forEach((col, idx) => {
        // Map database column names to TypeScript interface property names
        const propertyName = columnMap[col] || col
        element[propertyName] = row[idx]
      })
      return element as Element
    })
  }, [db])

  const element = allElements.find(el => el.E === selectedElement)

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
    } else {
      // Default to H (Z=1) if no valid element in URL
      setSelectedElement('H')
      setSearchParams({ Z: '1' }, { replace: true })
    }
  }, [db, allElements, searchParams, setSearchParams])

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
          } else {
            setSelectedNuclide(null)
          }
        } else {
          setSelectedNuclide(null) // Reset nuclide selection when element changes
        }
      }
    } else {
      setIsotopes([])
      setSelectedNuclide(null)
      setAtomicRadii(null)
    }
  }, [db, selectedElement, allElements, searchParams])

  // Handler to update element selection and URL
  const handleElementClick = (elementSymbol: string) => {
    const clickedElement = allElements.find(el => el.E === elementSymbol)
    if (clickedElement) {
      setSelectedElement(elementSymbol)
      setSearchParams({ Z: clickedElement.Z.toString() }, { replace: true })
    }
  }

  // Handler to update nuclide selection and URL
  const handleNuclideClick = (nuclide: Nuclide) => {
    setSelectedNuclide(nuclide)
    setSearchParams({ Z: nuclide.Z.toString(), A: nuclide.A.toString() }, { replace: true })
  }

  if (dbLoading) {
    return <DatabaseLoadingCard downloadProgress={downloadProgress} />
  }

  if (dbError) {
    return <DatabaseErrorCard error={dbError} />
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Show Element Data</h1>
        <p className="text-gray-600 dark:text-gray-400">View detailed chemical and physical properties for any element</p>
      </div>

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
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">Atomic Radii</h3>
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
          {isotopes.length > 0 && (
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
