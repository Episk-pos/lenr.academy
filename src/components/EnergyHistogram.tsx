import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label
} from 'recharts'
import { useTheme } from '../contexts/ThemeContext'
import { calculateBins, formatBinLabel, type BinData } from '../utils/histogramUtils'

interface EnergyHistogramProps {
  reactions: Array<{ MeV: number }>;
  binSize?: number;
  width?: number | string;
  height?: number;
}

export default function EnergyHistogram({
  reactions,
  binSize,
  width = '100%',
  height = 400
}: EnergyHistogramProps) {
  const { theme } = useTheme();

  // Extract energy values and calculate bins
  const bins = useMemo(() => {
    const energyValues = reactions.map(r => r.MeV);
    return calculateBins(energyValues, binSize);
  }, [reactions, binSize]);

  // Transform bins for Recharts
  const chartData = useMemo(() => {
    return bins.map(bin => ({
      energy: bin.binCenter,
      count: bin.count,
      label: formatBinLabel(bin.binStart, bin.binEnd),
      binStart: bin.binStart,
      binEnd: bin.binEnd
    }));
  }, [bins]);

  // Theme-aware colors
  const gridColor = theme === 'dark' ? '#374151' : '#E5E7EB';
  const textColor = theme === 'dark' ? '#9CA3AF' : '#6B7280';
  const barColor = '#10B981'; // Green for positive energy
  const tooltipBg = theme === 'dark' ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = theme === 'dark' ? '#374151' : '#E5E7EB';

  if (reactions.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        style={{ height }}
      >
        <p className="text-gray-500 dark:text-gray-400">No data to display</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="energy"
          stroke={textColor}
          tick={{ fill: textColor, fontSize: 12 }}
          tickFormatter={(value) => value.toFixed(1)}
        >
          <Label
            value="Energy (MeV)"
            position="insideBottom"
            offset={-10}
            style={{ fill: textColor, fontSize: 14, fontWeight: 500 }}
          />
        </XAxis>
        <YAxis
          stroke={textColor}
          tick={{ fill: textColor, fontSize: 12 }}
        >
          <Label
            value="Reaction Count"
            angle={-90}
            position="insideLeft"
            style={{ fill: textColor, fontSize: 14, fontWeight: 500, textAnchor: 'middle' }}
          />
        </YAxis>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div
                  className="px-3 py-2 rounded shadow-lg border"
                  style={{
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder
                  }}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {data.label} MeV
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Count: {data.count.toLocaleString()}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar
          dataKey="count"
          fill={barColor}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
