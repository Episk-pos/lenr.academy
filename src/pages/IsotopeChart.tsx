import { useState } from 'react';
import { Info, ZoomIn, RefreshCw } from 'lucide-react';
import IsotopeChartComponent from '../components/IsotopeChart';

export default function IsotopeChart() {
  const [showValley, setShowValley] = useState(true);
  const [showMagic, setShowMagic] = useState(true);
  const [showLegend, setShowLegend] = useState(true);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Isotope Chart (Segré Chart)
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Interactive N-Z diagram showing {' '}
              <span className="font-semibold">321 nuclides</span> with stability visualization
            </p>
          </div>
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Info size={16} />
            {showLegend ? 'Hide' : 'Show'} Legend
          </button>
        </div>
      </div>

      {/* Controls & Legend */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Toggle Controls */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showValley}
                onChange={(e) => setShowValley(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Valley of Stability
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showMagic}
                onChange={(e) => setShowMagic(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Magic Numbers
              </span>
            </label>
          </div>

          {/* Zoom Hints */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <ZoomIn size={14} />
              <span>Scroll to zoom</span>
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw size={14} />
              <span>Double-click to reset</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stability Legend */}
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                  Nuclide Stability
                </h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-600 dark:bg-green-500 rounded" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Stable (t½ {'>'} 1 billion years)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-600 dark:bg-orange-500 rounded" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Long-lived (t½ {'>'} 100 years)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-600 dark:bg-red-500 rounded" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Short-lived (t½ ≤ 100 years)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Unknown / Not in database
                    </span>
                  </div>
                </div>
              </div>

              {/* Chart Features */}
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                  Chart Features
                </h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500 border-dashed" style={{ borderTop: '2px dashed' }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Valley of Stability
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-purple-500 border-dashed" style={{ borderTop: '2px dashed' }} />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Magic Numbers (2, 8, 20, 28, 50, 82, 126)
                    </span>
                  </div>
                </div>
              </div>

              {/* Axes */}
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                  Axes
                </h3>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">X-axis:</span> Proton number (Z)
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Y-axis:</span> Neutron number (N)
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Range:</span> Z=1-94, N=0-150
                  </div>
                </div>
              </div>

              {/* Interactions */}
              <div>
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">
                  Interactions
                </h3>
                <div className="space-y-1">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Hover:</span> View nuclide details
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Click:</span> Navigate to element data
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Scroll:</span> Zoom in/out
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <span className="font-semibold">Drag:</span> Pan around chart
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <IsotopeChartComponent
          showValleyOfStability={showValley}
          showMagicNumbers={showMagic}
        />
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 px-6 py-3">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p>
              <strong>What is the Segré Chart?</strong> The isotope chart (N-Z diagram) plots all known nuclides by their neutron count (N)
              versus proton count (Z). The <strong className="text-green-600 dark:text-green-400">valley of stability</strong> shows where
              stable nuclides cluster. <strong className="text-purple-600 dark:text-purple-400">Magic numbers</strong> (2, 8, 20, 28, 50,
              82, 126) indicate particularly stable configurations where nuclear shells are filled, analogous to noble gases in chemistry.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
