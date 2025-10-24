import { useState, useMemo } from 'react';
import { BarChart3, Network, Table2, TrendingUp, Info } from 'lucide-react';
import type { CascadeResults } from '../types';
import { analyzePathways, getPathwayStats } from '../services/pathwayAnalyzer';
import CascadeSankeyDiagram from './CascadeSankeyDiagram';
import PathwayBrowserTable from './PathwayBrowserTable';
import CascadeNetworkDiagram from './CascadeNetworkDiagram';

interface CascadeTabsProps {
  results: CascadeResults;
  fuelNuclides?: string[];  // Original fuel nuclides for color coding
}

type TabId = 'summary' | 'flow' | 'pathways' | 'network' | 'products';

/**
 * Cascade Results Tabs
 *
 * Provides multiple views of cascade results:
 * - Summary: Key metrics and statistics
 * - Flow: Sankey diagram showing top pathways
 * - Pathways: Sortable table for pattern discovery
 * - Network: Hierarchical network diagram (optional)
 * - Products: Bar chart of top products
 */
export default function CascadeTabs({ results, fuelNuclides = [] }: CascadeTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary');

  // Analyze pathways for all tabs
  const pathways = useMemo(
    () => analyzePathways(results.reactions),
    [results.reactions]
  );

  const stats = useMemo(() => getPathwayStats(pathways), [pathways]);

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: 'summary', label: 'Summary', icon: <Info className="w-4 h-4" /> },
    { id: 'flow', label: 'Flow View', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'pathways', label: 'Pathway Browser', icon: <Table2 className="w-4 h-4" /> },
    { id: 'network', label: 'Network', icon: <Network className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Unique Pathways</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalPathways}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Reactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalReactions}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Feedback Loops</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.feedbackCount}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Frequency</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.avgFrequency.toFixed(1)}×
                </p>
              </div>
            </div>

            {/* Highlights */}
            <div className="grid md:grid-cols-2 gap-4">
              {stats.mostCommon && (
                <div className="card p-4 bg-blue-50 dark:bg-blue-900/20">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Most Common Pathway
                  </h4>
                  <p className="font-mono text-sm text-gray-900 dark:text-white mb-2">
                    {stats.mostCommon.pathway}
                  </p>
                  <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                    <span>Frequency: ×{stats.mostCommon.frequency}</span>
                    <span>Energy: {stats.mostCommon.avgEnergy.toFixed(2)} MeV</span>
                  </div>
                </div>
              )}

              {stats.highestEnergy && (
                <div className="card p-4 bg-orange-50 dark:bg-orange-900/20">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                    Highest Energy Pathway
                  </h4>
                  <p className="font-mono text-sm text-gray-900 dark:text-white mb-2">
                    {stats.highestEnergy.pathway}
                  </p>
                  <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                    <span>Energy: {stats.highestEnergy.avgEnergy.toFixed(2)} MeV</span>
                    <span>Frequency: ×{stats.highestEnergy.frequency}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Info Note */}
            <div className="card p-4 bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                💡 <strong>Tip:</strong> Use the <strong>Flow View</strong> tab to see a visual representation
                of the top pathways, or <strong>Pathway Browser</strong> to explore all pathways with
                sorting and filtering.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'flow' && (
          <div className="card p-6">
            <CascadeSankeyDiagram pathways={pathways} fuelNuclides={fuelNuclides} />
          </div>
        )}

        {activeTab === 'pathways' && (
          <div className="card p-6">
            <PathwayBrowserTable pathways={pathways} />
          </div>
        )}

        {activeTab === 'network' && (
          <div className="card p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ℹ️ Network view shows hierarchical relationship between nuclides. For large cascades,
                the Flow View may be easier to read.
              </p>
            </div>
            <CascadeNetworkDiagram reactions={results.reactions} />
          </div>
        )}

        {activeTab === 'products' && (
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Products ({results.productDistribution.size} unique nuclides)
            </h3>
            <div className="space-y-2">
              {Array.from(results.productDistribution.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 20)
                .map(([nuclide, count], index) => {
                  const maxCount = Math.max(...Array.from(results.productDistribution.values()));
                  const percentage = (count / maxCount) * 100;
                  return (
                    <div key={nuclide} className="flex items-center gap-3">
                      <div className="w-8 text-xs text-gray-500 dark:text-gray-400 text-right">
                        #{index + 1}
                      </div>
                      <div className="w-20 font-mono text-sm font-medium text-gray-900 dark:text-white">
                        {nuclide}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 dark:bg-blue-500 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right">
                          {count}×
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
            {results.productDistribution.size > 20 && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Showing top 20 of {results.productDistribution.size} unique products.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
