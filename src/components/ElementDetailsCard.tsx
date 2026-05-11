import { X, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Element, AtomicRadiiData } from '../types'
import CitationBadge from './CitationBadge'
import { getCitationsForElement } from '../services/citationsService'

interface ElementDetailsCardProps {
  element: Element | null
  atomicRadii?: AtomicRadiiData | null
  onClose?: () => void
}

export default function ElementDetailsCard({ element, atomicRadii, onClose }: ElementDetailsCardProps) {
  const { t } = useTranslation()
  if (!element) return null

  const elementCitations = getCitationsForElement(element.Z)

  return (
    <div className="card p-6 animate-fade-in">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            <Link
              to={`/element-data?Z=${element.Z}`}
              className="text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
            >
              {element.EName} ({element.E})
            </Link>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('elements.atomicNumber')}: {element.Z}
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

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.periodicTable')}
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">{t('elements.atomicNumberZ')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Z}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">{t('elements.period')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Period}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600 dark:text-gray-400">{t('elements.group')}:</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Group}</dd>
            </div>
            {typeof element.AWeight === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.atomicWeight')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.AWeight.toFixed(3)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.atomicProperties')}
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.Valence === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.valence')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Valence}</dd>
              </div>
            )}
            {typeof element.Negativity === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.electronegativity')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{element.Negativity}</dd>
              </div>
            )}
            {typeof element.Affinity === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.electronAffinity')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.Affinity} kJ/mol
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.ionization')}
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.MaxIonNum === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.maxIonNumber')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{element.MaxIonNum}</dd>
              </div>
            )}
            {typeof element.MaxIonization === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.maxIonization')}:</dt>
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
            {t('elements.thermalProperties')}
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.Melting === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.meltingPoint')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.Melting.toFixed(2)} K
                </dd>
              </div>
            )}
            {typeof element.Boiling === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.boilingPoint')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.Boiling.toFixed(2)} K
                </dd>
              </div>
            )}
            {typeof element.SpecHeat === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.specificHeat')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.SpecHeat.toFixed(2)} J/(g·K)
                </dd>
              </div>
            )}
            {typeof element.ThermConduct === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.thermalConductivity')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.ThermConduct.toFixed(2)} W/(m·K)
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
            {t('elements.physicalProperties')}
          </h3>
          <dl className="space-y-2 text-sm">
            {typeof element.STPDensity === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.densitySTP')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.STPDensity.toFixed(3)} g/cm³
                </dd>
              </div>
            )}
            {typeof element.MolarVolume === 'number' && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.molarVolume')}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.MolarVolume.toFixed(2)} cm³/mol
                </dd>
              </div>
            )}
            {typeof element.ElectConduct === 'number' && !isNaN(element.ElectConduct) && (
              <div className="flex justify-between">
                <dt className="text-gray-600 dark:text-gray-400">{t('elements.electricalConductivity', { defaultValue: 'Electrical Conductivity' })}:</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">
                  {element.ElectConduct.toFixed(2)} MS/m
                </dd>
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
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm uppercase tracking-wide">
              {t('elements.atomicRadii')}
            </h3>
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
            <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
              <strong>{t('elements.empirical')}:</strong> {t('elements.empiricalMeasured').split(': ')[1]} • <strong>{t('elements.calculated')}:</strong> {t('elements.calculatedTheoretical').split(': ')[1]}<br />
              <strong>{t('elements.vanDerWaals')}:</strong> {t('elements.vanDerWaalsNonBonded').split(': ')[1]} • <strong>{t('elements.covalent')}:</strong> {t('elements.covalentBonded').split(': ')[1]}
            </div>
          </div>
        )}
      </div>

      {elementCitations.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                      view source
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
