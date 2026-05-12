import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ChevronDown } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface EnergyHistogramProps {
  reactions: Array<{ MeV: number }>
}

interface Bin {
  label: string
  count: number
  rangeStart: number
}

interface Stats {
  mean: number
  median: number
  min: number
  max: number
  stddev: number
  count: number
}

function calculateBins(reactions: Array<{ MeV: number }>): Bin[] {
  if (reactions.length === 0) return []

  const values = reactions.map(r => r.MeV)

  // Iterate instead of spread to avoid stack overflow on large arrays
  let dataMin = values[0]
  let dataMax = values[0]
  for (let i = 1; i < values.length; i++) {
    if (values[i] < dataMin) dataMin = values[i]
    if (values[i] > dataMax) dataMax = values[i]
  }

  // Sturges' rule for bin count
  const numBins = Math.max(1, Math.ceil(1 + Math.log2(values.length)))
  const range = dataMax - dataMin
  const binWidth = range === 0 ? 1 : range / numBins

  const bins: Bin[] = Array.from({ length: numBins }, (_, i) => ({
    label: `${(dataMin + i * binWidth).toFixed(1)}`,
    count: 0,
    rangeStart: dataMin + i * binWidth,
  }))

  for (const v of values) {
    const idx = range === 0 ? 0 : Math.min(Math.floor((v - dataMin) / binWidth), numBins - 1)
    bins[idx].count++
  }

  return bins
}

function calculateStats(reactions: Array<{ MeV: number }>): Stats | null {
  if (reactions.length === 0) return null

  const values = reactions.map(r => r.MeV)
  const n = values.length

  let sum = 0
  let min = values[0]
  let max = values[0]
  for (let i = 0; i < n; i++) {
    sum += values[i]
    if (values[i] < min) min = values[i]
    if (values[i] > max) max = values[i]
  }
  const mean = sum / n

  // Median via sorting a copy
  const sorted = [...values].sort((a, b) => a - b)
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)]

  // Population standard deviation
  let sumSqDiff = 0
  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean
    sumSqDiff += diff * diff
  }
  const stddev = Math.sqrt(sumSqDiff / n)

  return { mean, median, min, max, stddev, count: n }
}

export default function EnergyHistogram({ reactions }: EnergyHistogramProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [expanded, setExpanded] = useState(false)

  const bins = useMemo(() => calculateBins(reactions), [reactions])
  const stats = useMemo(() => calculateStats(reactions), [reactions])

  if (reactions.length === 0) return null

  const axisColor = isDark ? '#d1d5db' : '#4b5563'
  const gridColor = isDark ? '#4b5563' : '#e5e7eb'
  const tooltipBg = isDark ? '#1f2937' : '#ffffff'
  const tooltipBorder = isDark ? '#4b5563' : '#e5e7eb'

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('histogram.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('histogram.description')}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn btn-secondary p-2 ml-4"
          title={expanded ? t('histogram.collapse') : t('histogram.expand')}
          aria-label={expanded ? t('histogram.collapse') : t('histogram.expand')}
        >
          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="pt-4">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bins} margin={{ top: 5, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="label"
                tick={{ style: { fill: axisColor }, fontSize: 12 }}
                label={{ value: t('histogram.xAxisLabel'), position: 'insideBottom', offset: -15, style: { fill: axisColor } }}
              />
              <YAxis
                tick={{ style: { fill: axisColor }, fontSize: 12 }}
                label={{ value: t('histogram.yAxisLabel'), angle: -90, position: 'insideLeft', offset: 5, style: { fill: axisColor } }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${tooltipBorder}`,
                  borderRadius: '0.375rem',
                  color: isDark ? '#f3f4f6' : '#1f2937',
                }}
                labelStyle={{ color: isDark ? '#f3f4f6' : '#1f2937' }}
                itemStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
                cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                formatter={(value: number) => [value, t('histogram.reactions')]}
                labelFormatter={(label: string) => `${label} MeV`}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {bins.map((bin, index) => (
                  <Cell key={index} fill={bin.rangeStart < 0 ? '#ef4444' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Statistics */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              {([
                ['histogram.mean', stats.mean.toFixed(3)],
                ['histogram.median', stats.median.toFixed(3)],
                ['histogram.min', stats.min.toFixed(3)],
                ['histogram.max', stats.max.toFixed(3)],
                ['histogram.stddev', stats.stddev.toFixed(3)],
                ['histogram.count', stats.count.toLocaleString()],
              ] as const).map(([key, value]) => (
                <div key={key} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t(key)}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                    {value}
                  </div>
                  {key !== 'histogram.count' && (
                    <div className="text-xs text-gray-400 dark:text-gray-500">MeV</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
