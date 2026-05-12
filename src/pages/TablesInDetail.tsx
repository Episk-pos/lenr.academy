import { useTranslation } from 'react-i18next'

export default function TablesInDetail() {
  const { t } = useTranslation()

  const tables = [
    {
      name: 'FusionAll',
      descriptionKey: 'tables.fusionAllDescription',
      fields: ['id', 'E1', 'Z1', 'A1', 'E', 'Z', 'A', 'MeV', 'neutrino', 'nBorF1', 'aBorF1', 'nBorF', 'aBorF', 'BEin']
    },
    {
      name: 'FissionAll',
      descriptionKey: 'tables.fissionAllDescription',
      fields: ['id', 'E', 'Z', 'A', 'E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'MeV', 'neutrino', 'nBorF', 'aBorF', 'BEin']
    },
    {
      name: 'TwoToTwoAll',
      descriptionKey: 'tables.twoToTwoAllDescription',
      fields: ['id', 'E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'E3', 'Z3', 'A3', 'E4', 'Z4', 'A4', 'MeV', 'neutrino', 'BEin']
    },
    {
      name: 'NuclidesPlus',
      descriptionKey: 'tables.nuclidesPlusDescription',
      fields: ['id', 'Z', 'A', 'E', 'BE', 'AMU', 'nBorF', 'aBorF', 'LHL']
    },
    {
      name: 'ElementsPlus',
      descriptionKey: 'tables.elementsPlusDescription',
      fields: ['Z', 'E', 'EName', 'Period', 'Group', 'AWeight', 'Melting', 'Boiling', 'STPDensity', 'ThermConduct']
    },
  ]

  const fieldDefinitions = [
    { field: 'tables.fieldZ', description: 'tables.fieldZDescription' },
    { field: 'tables.fieldA', description: 'tables.fieldADescription' },
    { field: 'tables.fieldE', description: 'tables.fieldEDescription' },
    { field: 'tables.fieldMeV', description: 'tables.fieldMeVDescription' },
    { field: 'tables.fieldBE', description: 'tables.fieldBEDescription' },
    { field: 'tables.fieldBorF', description: 'tables.fieldBorFDescription' },
    { field: 'tables.fieldNeutrino', description: 'tables.fieldNeutrinoDescription' },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('tables.title')}</h1>
        <p className="text-gray-600 dark:text-gray-400">{t('tables.description')}</p>
      </div>

      <div className="space-y-4">
        {tables.map(table => (
          <div key={table.name} className="card p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{table.name}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{t(table.descriptionKey)}</p>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tables.fields')}:</h4>
              <div className="flex flex-wrap gap-2">
                {table.fields.map(field => (
                  <code key={field} className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono text-gray-800 dark:text-gray-200">
                    {field}
                  </code>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6 mt-6 bg-blue-50 dark:bg-blue-900/30">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('tables.fieldDefinitions')}</h3>
        <dl className="space-y-2 text-sm">
          {fieldDefinitions.map(({ field, description }) => (
            <div key={field}>
              <dt className="font-medium text-gray-900 dark:text-gray-100">{t(field)}</dt>
              <dd className="text-gray-600 dark:text-gray-400">{t(description)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
