import type { Nuclide } from '../types'
import type { SpecialParticleInfo } from '../constants/specialParticles'

interface ParticleDetailsCardProps {
  particle: SpecialParticleInfo
  nuclide: Nuclide | null
}

/**
 * Displays a concise card for particles that do not belong to the traditional periodic table.
 * These entries are stored in the nuclides table (e-, n*, ν) but lack matching Element data.
 */
export default function ParticleDetailsCard({ particle, nuclide }: ParticleDetailsCardProps) {
  if (!nuclide) return null

  return (
    <div className="card p-6 mt-6 border border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-900/20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 font-semibold px-3 py-1 text-lg">
              {particle.displaySymbol}
            </span>
            <span>{particle.name}</span>
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            {particle.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm text-gray-700 dark:text-gray-300">
          <div className="font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs col-span-2">
            Quick Facts
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">Charge</span>
            <span className="font-semibold">{particle.charge === 0 ? '0' : `${particle.charge > 0 ? '+' : ''}${particle.charge}`}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">Spin</span>
            <span className="font-semibold">{nuclide.SP ?? 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">Mass (amu)</span>
            <span className="font-semibold">{nuclide.AMU != null ? nuclide.AMU.toFixed(6) : 'N/A'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">Classification</span>
            <span className="font-semibold">
              {nuclide.nBorF === 'b' ? 'Boson' : 'Fermion'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-4 border border-blue-100/60 dark:border-blue-800/60">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-xs uppercase tracking-wide">Database Mapping</h3>
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">Nuclide ID</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{particle.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">Atomic Number (Z)</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.Z}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">Mass Number (A)</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.A}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-4 border border-blue-100/60 dark:border-blue-800/60">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-xs uppercase tracking-wide">Quantum Properties</h3>
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">Magnetic Moment</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.MD ?? 'N/A'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">Nuclear/Baryonic</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {nuclide.nBorF === 'b' ? 'Boson' : 'Fermion'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">Atomic/Fermionic</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {nuclide.aBorF === 'b' ? 'Boson' : 'Fermion'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-4 border border-blue-100/60 dark:border-blue-800/60">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-xs uppercase tracking-wide">Notes</h3>
          <p className="text-gray-700 dark:text-gray-300">
            This particle is stored alongside nuclides for due to its presence in reactions but does not correspond to a chemical element.
          </p>
        </div>
      </div>
    </div>
  )
}
