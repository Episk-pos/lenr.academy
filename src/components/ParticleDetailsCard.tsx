import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  if (!nuclide) return null

  const na = t('particleDetails.notAvailable')
  const borf = (v: string | undefined) => (v === 'b' ? t('elements.boson') : t('elements.fermion'))

  return (
    <div className="card p-6 mt-6 border border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-900/20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 font-semibold px-3 py-1 text-lg">
              {particle.displaySymbol}
            </span>
            <span>{particle.nameKey ? t(particle.nameKey) : particle.name}</span>
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            {particle.descriptionKey ? t(particle.descriptionKey) : particle.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm text-gray-700 dark:text-gray-300">
          <div className="font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs col-span-2">
            {t('particleDetails.quickFacts')}
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('particleDetails.charge')}</span>
            <span className="font-semibold">{particle.charge === 0 ? '0' : `${particle.charge > 0 ? '+' : ''}${particle.charge}`}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('particleDetails.spin')}</span>
            <span className="font-semibold">{nuclide.SP ?? na}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('elementData.columns.massAmu')}</span>
            <span className="font-semibold">{nuclide.AMU != null ? nuclide.AMU.toFixed(6) : na}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase text-gray-500 dark:text-gray-400">{t('elementData.classification')}</span>
            <span className="font-semibold">
              {borf(nuclide.nBorF)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 text-sm">
        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-4 border border-blue-100/60 dark:border-blue-800/60">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-xs uppercase tracking-wide">{t('particleDetails.databaseMapping')}</h3>
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">{t('particleDetails.nuclideId')}</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{particle.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">{t('elements.atomicNumberZ')}</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.Z}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">{t('elements.massNumberA')}</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.A}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-4 border border-blue-100/60 dark:border-blue-800/60">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-xs uppercase tracking-wide">{t('elements.quantumProperties')}</h3>
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">{t('elementData.magneticMoment')}</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{nuclide.MD ?? na}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">{t('particleDetails.nuclearBaryonic')}</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {borf(nuclide.nBorF)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600 dark:text-gray-400">{t('particleDetails.atomicFermionic')}</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {borf(nuclide.aBorF)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white/60 dark:bg-gray-900/40 rounded-lg p-4 border border-blue-100/60 dark:border-blue-800/60">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-xs uppercase tracking-wide">{t('particleDetails.notes')}</h3>
          <p className="text-gray-700 dark:text-gray-300">
            {t('particleDetails.storageNote')}
          </p>
        </div>
      </div>
    </div>
  )
}
