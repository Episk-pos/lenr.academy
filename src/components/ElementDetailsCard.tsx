import { X } from 'lucide-react'
import type { Element, AtomicRadiiData } from '../types'

interface ElementDetailsCardProps {
  element: Element | null
  atomicRadii?: AtomicRadiiData | null
  onClose?: () => void
}

export default function ElementDetailsCard({ element, atomicRadii, onClose }: ElementDetailsCardProps) {
  if (!element) return null

  return (
    <div className="card p-6 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {element.EName} ({element.E})
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Atomic Number: {element.Z}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close element details"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Periodic Table
          </h3>
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
            {typeof element.AWeight === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Atomic Weight:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.AWeight.toFixed(3)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Atomic Properties
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.Valence === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Valence:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Valence}</dd>
              </div>
            )}
            {typeof element.Negativity === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Electronegativity:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Negativity}</dd>
              </div>
            )}
            {typeof element.Affinity === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Electron Affinity:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.Affinity} kJ/mol
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Ionization
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.MaxIonNum === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Max Ion Number:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonNum}</dd>
              </div>
            )}
            {typeof element.MaxIonization === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Max Ionization:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.MaxIonization.toFixed(1)} kJ/mol
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Thermal Properties
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.Melting === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Melting Point:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.Melting.toFixed(2)} K
                </dd>
              </div>
            )}
            {typeof element.Boiling === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Boiling Point:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.Boiling.toFixed(2)} K
                </dd>
              </div>
            )}
            {typeof element.SpecHeat === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Specific Heat:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.SpecHeat.toFixed(2)} J/(g·K)
                </dd>
              </div>
            )}
            {typeof element.ThermConduct === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Thermal Conductivity:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.ThermConduct.toFixed(2)} W/(m·K)
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            Physical Properties
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.STPDensity === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Density (STP):</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.STPDensity.toFixed(3)} g/cm³
                </dd>
              </div>
            )}
            {typeof element.MolarVolume === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Molar Volume:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.MolarVolume.toFixed(2)} cm³/mol
                </dd>
              </div>
            )}
            {typeof element.ElectConduct === 'number' && !isNaN(element.ElectConduct) && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">Electrical Conductivity:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.ElectConduct.toFixed(2)} MS/m
                </dd>
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
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              Atomic Radii
            </h3>
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
    </div>
  )
}
