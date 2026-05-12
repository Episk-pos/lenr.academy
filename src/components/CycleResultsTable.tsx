import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Eye,
  Play,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react'
import type { DiscoveredCycle } from '../types'

interface CycleResultsTableProps {
  cycles: DiscoveredCycle[]
  onViewCycle: (cycle: DiscoveredCycle) => void
  onRunSimulation: (cycle: DiscoveredCycle) => void
}

type SortKey =
  | 'fuel'
  | 'cycleDepth'
  | 'totalEnergy'
  | 'feedbackRatio'
  | 'abundanceScore'
  | 'stabilityScore'

type SortDirection = 'asc' | 'desc'

function NuclideBadge({ nuclide }: { nuclide: { E: string; A: number } }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 mr-1 mb-1">
      <sup className="text-[10px] mr-0.5">{nuclide.A}</sup>
      {nuclide.E}
    </span>
  )
}

/**
 * Small SVG icon showing N dots arranged in a circle with a closing arrow,
 * to indicate this row represents a closed cycle.
 */
function CyclePreviewIcon({ steps }: { steps: number }) {
  // Cap visible dots at 8 to avoid clutter
  const n = Math.max(2, Math.min(8, steps))
  const cx = 12
  const cy = 12
  const r = 8
  // Distribute dots evenly around the circle, starting from the top
  const dots = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    }
  })

  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6 flex-shrink-0 text-amber-600 dark:text-amber-400"
      aria-label={`Cycle with ${steps} steps`}
    >
      {/* Background ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        className="stroke-amber-200 dark:stroke-amber-800"
        strokeWidth={1}
        strokeDasharray="2 2"
      />
      {/* Step dots */}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={1.6}
          className="fill-amber-500 dark:fill-amber-400"
        />
      ))}
      {/* Closing arrow head at top */}
      <path
        d="M 11.2 4.6 L 12 3 L 12.8 4.6"
        fill="none"
        className="stroke-amber-600 dark:stroke-amber-400"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[80px]">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 w-8 text-right">
        {value.toFixed(0)}
      </span>
    </div>
  )
}

export default function CycleResultsTable({
  cycles,
  onViewCycle,
  onRunSimulation,
}: CycleResultsTableProps) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<SortKey>('totalEnergy')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...cycles]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'fuel':
          cmp =
            a.fuelNuclides.map((n) => `${n.E}-${n.A}`).join(',')
              .localeCompare(
                b.fuelNuclides.map((n) => `${n.E}-${n.A}`).join(',')
              )
          break
        case 'cycleDepth':
          cmp = a.cycleDepth - b.cycleDepth
          break
        case 'totalEnergy':
          cmp = a.totalEnergy - b.totalEnergy
          break
        case 'feedbackRatio':
          cmp = a.feedbackRatio - b.feedbackRatio
          break
        case 'abundanceScore':
          cmp = a.abundanceScore - b.abundanceScore
          break
        case 'stabilityScore':
          cmp = a.stabilityScore - b.stabilityScore
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return arr
  }, [cycles, sortKey, sortDirection])

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    )
  }

  if (cycles.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {t('cycleDiscovery.noResults')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          {t('cycleDiscovery.noResultsDescription')}
        </p>
      </div>
    )
  }

  const columns: Array<{
    key: SortKey
    labelKey: string
    className?: string
  }> = [
    { key: 'fuel', labelKey: 'cycleDiscovery.columnFuel', className: 'min-w-[140px]' },
    { key: 'cycleDepth', labelKey: 'cycleDiscovery.columnDepth' },
    { key: 'totalEnergy', labelKey: 'cycleDiscovery.columnEnergy' },
    { key: 'feedbackRatio', labelKey: 'cycleDiscovery.columnFeedback' },
    { key: 'abundanceScore', labelKey: 'cycleDiscovery.columnAbundance' },
    { key: 'stabilityScore', labelKey: 'cycleDiscovery.columnStability' },
  ]

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('cycleDiscovery.resultsTitle', { count: cycles.length })}
        </h3>
      </div>

      <div className="table-container border-0 rounded-none">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${col.className ?? ''}`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {t(col.labelKey)}
                    <SortIcon column={col.key} />
                  </span>
                </th>
              ))}
              <th className="w-24">{t('cycleDiscovery.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((cycle) => (
              <tr
                key={cycle.id}
                onClick={() => onViewCycle(cycle)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onViewCycle(cycle)
                  } else if (e.key === ' ') {
                    e.preventDefault()
                    onViewCycle(cycle)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={t('cycleDiscovery.viewCycleAriaLabel', { id: cycle.id })}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <td>
                  <div className="flex items-start gap-2">
                    <CyclePreviewIcon steps={cycle.cycleDepth} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap">
                        {cycle.fuelNuclides.map((n, i) => (
                          <NuclideBadge key={i} nuclide={n} />
                        ))}
                      </div>
                      <div className="text-[10px] italic text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                        {cycle.fuelNuclides.map((n) => `${n.E}-${n.A}`).join(' + ')}
                        {' ⟳ +'}
                        {cycle.totalEnergy.toFixed(1)} MeV
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="font-mono text-sm">
                    {cycle.cycleDepth}
                  </span>
                </td>
                <td>
                  <span className="font-mono text-sm font-medium text-green-700 dark:text-green-400">
                    {cycle.totalEnergy.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                    MeV
                  </span>
                </td>
                <td>
                  <ScoreBar
                    value={cycle.feedbackRatio}
                    color="bg-amber-500 dark:bg-amber-400"
                  />
                </td>
                <td>
                  <ScoreBar
                    value={cycle.abundanceScore}
                    color="bg-blue-500 dark:bg-blue-400"
                  />
                </td>
                <td>
                  <ScoreBar
                    value={cycle.stabilityScore}
                    color="bg-emerald-500 dark:bg-emerald-400"
                  />
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewCycle(cycle)
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      title={t('cycleDiscovery.viewCycle')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRunSimulation(cycle)
                      }}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                      title={t('cycleDiscovery.simulateCycle')}
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
