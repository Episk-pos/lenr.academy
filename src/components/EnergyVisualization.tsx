import { useState, useMemo, useRef } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import EnergyHistogram from './EnergyHistogram'
import EnergyStatistics from './EnergyStatistics'
import { calculateStatistics, calculateSturgesBinSize } from '../utils/histogramUtils'

export type ViewMode = 'chart' | 'stats' | 'both'

interface EnergyVisualizationProps {
  reactions: Array<{ MeV: number }>;
  title?: string;
  defaultExpanded?: boolean;
}

export default function EnergyVisualization({
  reactions,
  title = 'Energy Distribution',
  defaultExpanded = true
}: EnergyVisualizationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [binSize, setBinSize] = useState<number | undefined>(undefined);
  const chartRef = useRef<HTMLDivElement>(null);

  // Calculate statistics
  const statistics = useMemo(() => {
    const energyValues = reactions.map(r => r.MeV);
    return calculateStatistics(energyValues);
  }, [reactions]);

  // Calculate default bin size using Sturges' rule
  const defaultBinSize = useMemo(() => {
    if (statistics.count === 0) return 1;
    return calculateSturgesBinSize(statistics.count, statistics.range);
  }, [statistics]);

  // Use custom bin size or default
  const effectiveBinSize = binSize ?? defaultBinSize;

  // Export chart as PNG
  const handleExport = async () => {
    if (!chartRef.current) return;

    try {
      // Dynamically import html2canvas to avoid bundling it if not used
      const html2canvas = (await import('html2canvas')).default;

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: null,
        scale: 2 // Higher quality
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `energy-distribution-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (error) {
      console.error('Failed to export chart:', error);
      alert('Failed to export chart. Please try again.');
    }
  };

  // Handle bin size change from slider
  const handleBinSizeChange = (value: number) => {
    // Use a percentage of the range to determine bin size
    // 0-100 slider maps to 1% to 50% of range
    const percentage = (value / 100) * 0.49 + 0.01; // 1% to 50%
    const customBinSize = statistics.range * percentage;
    setBinSize(customBinSize);
  };

  // Reset to auto bin size
  const resetBinSize = () => {
    setBinSize(undefined);
  };

  // Calculate slider value from current bin size
  const sliderValue = useMemo(() => {
    if (binSize === undefined) return 50; // Middle value for auto
    const percentage = binSize / statistics.range;
    return Math.round(((percentage - 0.01) / 0.49) * 100);
  }, [binSize, statistics.range]);

  if (reactions.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No reactions to visualize. Run a query to see energy distribution.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Statistical analysis and histogram of reaction energy distribution
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="btn btn-secondary p-2 ml-4"
          title={isExpanded ? 'Collapse visualization' : 'Expand visualization'}
          aria-label={isExpanded ? 'Collapse visualization' : 'Expand visualization'}
        >
          <ChevronDown
            className={`w-5 h-5 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {/* Statistics Panel */}
        <div className="mb-6">
          <EnergyStatistics statistics={statistics} />
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Bin Size Control */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="bin-size-slider"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Bin Size: {effectiveBinSize.toFixed(2)} MeV
                {binSize === undefined && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(Auto)</span>
                )}
              </label>
              {binSize !== undefined && (
                <button
                  onClick={resetBinSize}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Reset to Auto
                </button>
              )}
            </div>
            <input
              id="bin-size-slider"
              type="range"
              min="0"
              max="100"
              value={sliderValue}
              onChange={(e) => handleBinSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>Fine</span>
              <span>Coarse</span>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex items-end">
            <button
              onClick={handleExport}
              className="btn btn-secondary px-4 py-2 text-sm whitespace-nowrap"
              title="Export chart as PNG"
            >
              <Download className="w-4 h-4 mr-2 inline" />
              Export PNG
            </button>
          </div>
        </div>

        {/* Chart */}
        <div
          ref={chartRef}
          className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <EnergyHistogram
            reactions={reactions}
            binSize={effectiveBinSize}
            height={400}
          />
        </div>
      </div>
    </div>
  );
}
