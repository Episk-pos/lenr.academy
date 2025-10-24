import type { EnergyStatistics as Stats } from '../utils/histogramUtils'

interface EnergyStatisticsProps {
  statistics: Stats;
}

export default function EnergyStatistics({ statistics }: EnergyStatisticsProps) {
  const stats = [
    { label: 'Total Reactions', value: statistics.count.toLocaleString(), unit: '' },
    { label: 'Mean Energy', value: statistics.mean.toFixed(2), unit: 'MeV' },
    { label: 'Median Energy', value: statistics.median.toFixed(2), unit: 'MeV' },
    { label: 'Min Energy', value: statistics.min.toFixed(2), unit: 'MeV' },
    { label: 'Max Energy', value: statistics.max.toFixed(2), unit: 'MeV' },
    { label: 'Std Deviation', value: statistics.stdDev.toFixed(2), unit: 'MeV' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            {stat.label}
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {stat.value}
            {stat.unit && (
              <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-1">
                {stat.unit}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
