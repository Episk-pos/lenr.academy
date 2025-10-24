import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Filter } from 'lucide-react';
import type { PathwayAnalysis } from '../services/pathwayAnalyzer';
import { VirtualizedList } from './VirtualizedList';

interface PathwayBrowserTableProps {
  pathways: PathwayAnalysis[];
}

type SortField = 'frequency' | 'avgEnergy' | 'totalEnergy' | 'rarity';
type SortDirection = 'asc' | 'desc';

/**
 * Pathway Browser Table
 *
 * Sortable, filterable table for exploring cascade pathways.
 * Enables pattern discovery through ranking and filtering.
 */
export default function PathwayBrowserTable({ pathways }: PathwayBrowserTableProps) {
  const [sortField, setSortField] = useState<SortField>('frequency');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFusion, setShowFusion] = useState(true);
  const [showTwoToTwo, setShowTwoToTwo] = useState(true);
  const [feedbackOnly, setFeedbackOnly] = useState(false);
  const [minFrequency, setMinFrequency] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort pathways
  const filteredAndSorted = useMemo(() => {
    let result = [...pathways];

    // Apply filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.inputs.some((n) => n.toLowerCase().includes(term)) ||
          p.outputs.some((n) => n.toLowerCase().includes(term))
      );
    }

    if (!showFusion || !showTwoToTwo) {
      result = result.filter((p) => {
        if (p.type === 'fusion') return showFusion;
        if (p.type === 'twotwo') return showTwoToTwo;
        return false;
      });
    }

    if (feedbackOnly) {
      result = result.filter((p) => p.isFeedback);
    }

    if (minFrequency > 1) {
      result = result.filter((p) => p.frequency >= minFrequency);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'frequency':
          comparison = a.frequency - b.frequency;
          break;
        case 'avgEnergy':
          comparison = a.avgEnergy - b.avgEnergy;
          break;
        case 'totalEnergy':
          comparison = a.totalEnergy - b.totalEnergy;
          break;
        case 'rarity':
          comparison = a.rarityScore - b.rarityScore;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [pathways, sortField, sortDirection, searchTerm, showFusion, showTwoToTwo, feedbackOnly, minFrequency]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      {children}
      {sortField === field && (
        <ArrowUpDown
          className={`w-3 h-3 transition-transform ${
            sortDirection === 'asc' ? 'rotate-180' : ''
          }`}
        />
      )}
    </button>
  );

  const maxFrequency = Math.max(...pathways.map((p) => p.frequency), 1);

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by nuclide name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>

        {/* Filters Panel */}
        {showFilters && (
          <div className="card p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
            {/* Type Filters */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Reaction Types:</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFusion}
                    onChange={(e) => setShowFusion(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Fusion</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTwoToTwo}
                    onChange={(e) => setShowTwoToTwo(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Two-to-Two</span>
                </label>
              </div>
            </div>

            {/* Feedback Filter */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={feedbackOnly}
                  onChange={(e) => setFeedbackOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show only feedback loops
                </span>
              </label>
            </div>

            {/* Min Frequency Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Frequency: {minFrequency}×
              </label>
              <input
                type="range"
                min="1"
                max={Math.min(maxFrequency, 100)}
                value={minFrequency}
                onChange={(e) => setMinFrequency(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredAndSorted.length} of {pathways.length} pathways
      </p>

      {/* Table with Virtualization */}
      <div className="rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
        {/* Fixed Table Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium" style={{ width: '30%' }}>Pathway</th>
                <th className="px-4 py-3 text-left font-medium" style={{ width: '10%' }}>Type</th>
                <th className="px-4 py-3 text-right font-medium" style={{ width: '10%' }}>
                  <SortButton field="frequency">Frequency</SortButton>
                </th>
                <th className="px-4 py-3 text-right font-medium" style={{ width: '12%' }}>
                  <SortButton field="avgEnergy">Avg Energy</SortButton>
                </th>
                <th className="px-4 py-3 text-right font-medium" style={{ width: '12%' }}>
                  <SortButton field="totalEnergy">Total Energy</SortButton>
                </th>
                <th className="px-4 py-3 text-center font-medium" style={{ width: '10%' }}>Loops</th>
                <th className="px-4 py-3 text-center font-medium" style={{ width: '8%' }}>Feedback</th>
                <th className="px-4 py-3 text-right font-medium" style={{ width: '8%' }}>
                  <SortButton field="rarity">Rarity</SortButton>
                </th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Virtualized Table Body */}
        <VirtualizedList
          items={filteredAndSorted}
          height={600}
          fixedRowHeight={48}
          overscanRowCount={10}
          ariaLabel="Pathway results table"
        >
          {(pathway) => (
            <div className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="text-gray-900 dark:text-gray-100">
                    <td className="px-4 py-3 font-mono text-sm" style={{ width: '30%' }}>{pathway.pathway}</td>
                    <td className="px-4 py-3" style={{ width: '10%' }}>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          pathway.type === 'fusion'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                        }`}
                      >
                        {pathway.type === 'fusion' ? 'Fusion' : '2→2'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium" style={{ width: '10%' }}>×{pathway.frequency}</td>
                    <td className="px-4 py-3 text-right" style={{ width: '12%' }}>{pathway.avgEnergy.toFixed(2)} MeV</td>
                    <td className="px-4 py-3 text-right" style={{ width: '12%' }}>{pathway.totalEnergy.toFixed(2)} MeV</td>
                    <td className="px-4 py-3 text-center text-xs text-gray-600 dark:text-gray-400" style={{ width: '10%' }}>
                      {pathway.loops.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ width: '8%' }}>
                      {pathway.isFeedback && (
                        <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-600 dark:text-gray-400" style={{ width: '8%' }}>
                      {pathway.rarityScore.toFixed(0)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </VirtualizedList>
      </div>

      {filteredAndSorted.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No pathways match your filters. Try adjusting the criteria.
        </div>
      )}
    </div>
  );
}
