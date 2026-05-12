import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDatabase } from '../contexts/DatabaseContext'
import { getAllNuclides } from '../services/queryService'
import DatabaseLoadingCard from '../components/DatabaseLoadingCard'
import SegreChartDiagram, { type ChartNuclide } from '../components/SegreChartDiagram'
import type { Nuclide } from '../types'

type StabilityCategory = 'stable' | 'long' | 'short' | 'unknown'

function classifyStability(logHalfLife?: number | null): StabilityCategory {
  if (logHalfLife === undefined || logHalfLife === null) return 'unknown'
  if (logHalfLife > 9) return 'stable'
  if (logHalfLife > 2) return 'long'
  return 'short'
}

export default function SegreChart() {
  const { t } = useTranslation()
  const { db, isLoading: dbLoading, downloadProgress } = useDatabase()
  const [nuclides, setNuclides] = useState<Nuclide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!db) return
    try {
      const all = getAllNuclides(db)
      setNuclides(all)
    } finally {
      setLoading(false)
    }
  }, [db])

  const chartNuclides: ChartNuclide[] = useMemo(() => {
    return nuclides.map(n => ({
      Z: n.Z,
      N: n.A - n.Z,
      A: n.A,
      E: n.E,
      stability: classifyStability(n.logHalfLife),
      logHalfLife: n.logHalfLife,
    }))
  }, [nuclides])

  const stabilityCounts = useMemo(() => {
    const counts = { stable: 0, long: 0, short: 0, unknown: 0 }
    for (const n of chartNuclides) {
      counts[n.stability]++
    }
    return counts
  }, [chartNuclides])

  if (dbLoading || !db) {
    return (
      <div className="max-w-7xl mx-auto">
        <DatabaseLoadingCard downloadProgress={downloadProgress} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="card p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('segreChart.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('segreChart.description')}
        </p>
      </div>

      {loading ? (
        <div className="card p-6 text-center text-gray-500 dark:text-gray-400">
          {t('common.loading')}
        </div>
      ) : (
        <>
          <div className="card p-6 mb-6">
            <SegreChartDiagram nuclides={chartNuclides} />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              {t('segreChart.zoomControls')}
            </p>
          </div>

          {/* Legend */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('segreChart.legend')}
            </h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#16a34a' }} />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('segreChart.stable')} ({stabilityCounts.stable})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ea580c' }} />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('segreChart.longHalfLife')} ({stabilityCounts.long})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }} />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('segreChart.shortHalfLife')} ({stabilityCounts.short})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: '#9ca3af' }} />
                <span className="text-gray-600 dark:text-gray-400">
                  {t('segreChart.unknown')} ({stabilityCounts.unknown})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5" style={{ borderTop: '2px dashed rgba(59, 130, 246, 0.5)' }} />
                <span className="text-gray-600 dark:text-gray-400">{t('segreChart.magicNumbers')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5" style={{ borderTop: '2px dashed rgba(202, 138, 4, 0.7)' }} />
                <span className="text-gray-600 dark:text-gray-400">{t('segreChart.valleyOfStability')}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              {t('segreChart.nuclideCount', { count: chartNuclides.length })} — {t('segreChart.clickToView')}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
