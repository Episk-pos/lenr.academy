import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDatabase } from '../contexts/DatabaseContext'
import PageHeader from '../components/PageHeader'
import { PAGE_ICONS } from '../constants/pageIcons'

interface TableColumnInfo {
  name: string
  type: string
}

// Table/view names shown on this page, with their (translated) human descriptions.
// Column lists are derived at runtime from the loaded database so they can't drift from the schema.
const TABLES: { name: string; descriptionKey: string }[] = [
  { name: 'FusionAll', descriptionKey: 'tables.fusionAllDescription' },
  { name: 'FissionAll', descriptionKey: 'tables.fissionAllDescription' },
  { name: 'TwoToTwoAll', descriptionKey: 'tables.twoToTwoAllDescription' },
  { name: 'NuclidesPlus', descriptionKey: 'tables.nuclidesPlusDescription' },
  { name: 'ElementPropertiesPlus', descriptionKey: 'tables.elementPropertiesPlusDescription' },
  { name: 'AtomicRadii', descriptionKey: 'tables.atomicRadiiDescription' },
  { name: 'RadioNuclides', descriptionKey: 'tables.radioNuclidesDescription' },
  { name: 'ElementsPlus', descriptionKey: 'tables.elementsPlusDescription' },
]

export default function TablesInDetail() {
  const { t } = useTranslation()
  const { db } = useDatabase()

  const columnsByTable = useMemo(() => {
    const result: Record<string, TableColumnInfo[]> = {}
    if (!db) return result
    for (const { name } of TABLES) {
      try {
        // PRAGMA table_info rows: [cid, name, type, notnull, dflt_value, pk]
        const res = db.exec(`PRAGMA table_info(${name})`)
        result[name] = (res[0]?.values ?? []).map(row => ({
          name: String(row[1]),
          type: String(row[2] ?? ''),
        }))
      } catch {
        result[name] = []
      }
    }
    return result
  }, [db])

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
      <PageHeader
        icon={PAGE_ICONS.tablesInDetail}
        title={t('tables.title')}
        subtitle={t('tables.description')}
      />

      <div className="space-y-4">
        {TABLES.map(table => {
          const columns = columnsByTable[table.name]
          return (
            <div key={table.name} className="card p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{table.name}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{t(table.descriptionKey)}</p>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('tables.fields')}:</h4>
                {columns ? (
                  <div className="flex flex-wrap gap-2">
                    {columns.map(col => (
                      <code
                        key={col.name}
                        title={col.type || undefined}
                        className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono text-gray-800 dark:text-gray-200"
                      >
                        {col.name}
                      </code>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
                )}
              </div>
            </div>
          )
        })}
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
