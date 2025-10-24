import { useState } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { Sliders, HelpCircle, X, ArrowRight } from 'lucide-react';
import type { PathwayAnalysis } from '../services/pathwayAnalyzer';

interface CascadeSankeyDiagramProps {
  pathways: PathwayAnalysis[];
  fuelNuclides?: string[];  // Original fuel nuclides for color coding
}

type NodeType = 'fuel' | 'intermediate' | 'final';

interface EnhancedNode {
  name: string;
  type: NodeType;
  color: string;
}

/**
 * Convert pathways to Sankey data format with color coding
 * Recharts Sankey expects node indices (numbers) for source/target
 */
function pathwaysToSankeyData(pathways: PathwayAnalysis[], fuelNuclides: string[] = []) {
  const nodeMap = new Map<string, number>();
  const nodes: EnhancedNode[] = [];
  const links: Array<{ source: number; target: number; value: number; pathway: PathwayAnalysis }> = [];

  // Normalize fuel nuclides (convert H1, D, T to standard format)
  const normalizedFuel = new Set(
    fuelNuclides.map((n) => {
      const trimmed = n.trim();
      if (trimmed === 'D') return 'D-2';
      if (trimmed === 'T') return 'T-3';
      // Convert H1 to H-1 format
      const match = trimmed.match(/^([A-Z][a-z]?)[-\s]?(\d+)$/);
      if (match) return `${match[1]}-${match[2]}`;
      return trimmed;
    })
  );

  // Track which nodes have outgoing edges (to identify final products)
  const hasOutgoingEdges = new Set<string>();
  pathways.forEach((pathway) => {
    pathway.inputs.forEach((input) => hasOutgoingEdges.add(input));
  });

  // Build node list and index map with type classification
  pathways.forEach((pathway) => {
    [...pathway.inputs, ...pathway.outputs].forEach((nuclide) => {
      if (!nodeMap.has(nuclide)) {
        const index = nodes.length;
        nodeMap.set(nuclide, index);

        // Determine node type and color
        let type: NodeType;
        let color: string;

        if (normalizedFuel.has(nuclide)) {
          type = 'fuel';
          color = '#10b981'; // Green for fuel
        } else if (!hasOutgoingEdges.has(nuclide)) {
          type = 'final';
          color = '#f97316'; // Orange for final products
        } else {
          type = 'intermediate';
          color = '#3b82f6'; // Blue for intermediates
        }

        nodes.push({ name: nuclide, type, color });
      }
    });
  });

  // Build links using node indices
  pathways.forEach((pathway) => {
    const sourceIndex = nodeMap.get(pathway.inputs[0]);
    const targetIndex = nodeMap.get(pathway.outputs[0]);

    if (sourceIndex !== undefined && targetIndex !== undefined) {
      links.push({
        source: sourceIndex,
        target: targetIndex,
        value: pathway.frequency,
        pathway,
      });
    }
  });

  return {
    nodes,
    links,
  };
}

/**
 * Cascade Sankey Diagram
 *
 * Shows flow of cascade reactions from fuel nuclides through intermediates to products.
 * Width of flows represents pathway frequency.
 */
export default function CascadeSankeyDiagram({ pathways, fuelNuclides = [] }: CascadeSankeyDiagramProps) {
  const [topN, setTopN] = useState(20);
  const [feedbackOnly, setFeedbackOnly] = useState(false);
  const [minFrequency, setMinFrequency] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [showGuide, setShowGuide] = useState(() => {
    // Show guide on first visit
    const hasSeenGuide = localStorage.getItem('cascade-sankey-guide-seen');
    return !hasSeenGuide;
  });

  const handleCloseGuide = () => {
    localStorage.setItem('cascade-sankey-guide-seen', 'true');
    setShowGuide(false);
  };

  // Apply filters
  let filteredPathways = [...pathways];

  if (feedbackOnly) {
    filteredPathways = filteredPathways.filter((p) => p.isFeedback);
  }

  if (minFrequency > 1) {
    filteredPathways = filteredPathways.filter((p) => p.frequency >= minFrequency);
  }

  // Limit to top N
  filteredPathways = filteredPathways.slice(0, topN);

  // Convert to Sankey format with color coding
  const sankeyData = pathwaysToSankeyData(filteredPathways, fuelNuclides);

  // Calculate max frequency for color scaling
  const maxFrequency = Math.max(...pathways.map((p) => p.frequency), 1);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    if (!data.pathway) return null;

    const pathway = data.pathway as PathwayAnalysis;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-lg">
        <p className="font-semibold text-gray-900 dark:text-white mb-2">{pathway.pathway}</p>
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p>
            <span className="font-medium">Type:</span>{' '}
            <span className={pathway.type === 'fusion' ? 'text-blue-600' : 'text-purple-600'}>
              {pathway.type === 'fusion' ? 'Fusion' : 'Two-to-Two'}
            </span>
          </p>
          <p>
            <span className="font-medium">Frequency:</span> ×{pathway.frequency}
          </p>
          <p>
            <span className="font-medium">Avg Energy:</span> {pathway.avgEnergy.toFixed(2)} MeV
          </p>
          {pathway.isFeedback && (
            <p className="text-green-600 font-medium">✓ Feedback Loop</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Loops: {pathway.loops.join(', ')}
          </p>
        </div>
      </div>
    );
  };

  if (pathways.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
        No pathways to display
      </div>
    );
  }

  if (filteredPathways.length === 0) {
    return (
      <div className="space-y-4">
        {/* Filter Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Sliders className="w-4 h-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>

        <div className="flex items-center justify-center h-96 text-gray-500 dark:text-gray-400">
          No pathways match current filters. Try adjusting your filter criteria.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* First-Time User Guide Overlay */}
      {showGuide && (
        <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-400">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                  How to Read This Diagram
                </h4>
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p>👋 This shows your cascade reactions flowing from <strong>left to right</strong>:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong className="text-green-700 dark:text-green-300">Green boxes</strong> = Your fuel nuclides (starting materials)</li>
                  <li><strong className="text-blue-700 dark:text-blue-300">Blue boxes</strong> = Intermediate products (created and consumed)</li>
                  <li><strong className="text-orange-700 dark:text-orange-300">Orange boxes</strong> = Final products (not consumed further)</li>
                  <li><strong>Thicker flows</strong> = More frequent reaction pathways</li>
                  <li><strong>Hover</strong> over flows to see reaction details</li>
                </ul>
              </div>
            </div>
            <button
              onClick={handleCloseGuide}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header with Visual Guide */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Reaction Flow Diagram
          </h3>
          {!showGuide && (
            <button
              onClick={() => setShowGuide(true)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Show guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Sliders className="w-4 h-4" />
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {/* Visual Flow Direction Guide */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-12 h-8 bg-green-500 dark:bg-green-600 rounded flex items-center justify-center text-white text-xs font-bold">
            Fuel
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 h-8 bg-blue-500 dark:bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
            Intermediate
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </div>
        <div className="w-12 h-8 bg-orange-500 dark:bg-orange-600 rounded flex items-center justify-center text-white text-xs font-bold">
          Final
        </div>
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <div className="card p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
          {/* Top N Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Show Top Pathways: {topN}
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={topN}
              onChange={(e) => setTopN(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>5</span>
              <span>100</span>
            </div>
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
              step="1"
              value={minFrequency}
              onChange={(e) => setMinFrequency(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>1</span>
              <span>{Math.min(maxFrequency, 100)}</span>
            </div>
          </div>

          {/* Feedback Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="feedback-only"
              checked={feedbackOnly}
              onChange={(e) => setFeedbackOnly(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label
              htmlFor="feedback-only"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              Show only feedback loops
            </label>
          </div>
        </div>
      )}

      {/* Showing N of M message */}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Showing {filteredPathways.length} of {pathways.length} total pathways
        {feedbackOnly && ` (${pathways.filter((p) => p.isFeedback).length} with feedback loops)`}
      </p>

      {/* Sankey Diagram */}
      <ResponsiveContainer width="100%" height={500}>
        <Sankey
          data={sankeyData}
          node={(nodeProps: any) => {
            const { x, y, width, height, index, containerWidth } = nodeProps;
            const node = sankeyData.nodes[index] as EnhancedNode;

            // Determine if node is on left or right side of diagram
            // Nodes in first third are "left", last third are "right"
            const isLeftSide = x < containerWidth / 3;
            const isRightSide = x > (containerWidth * 2) / 3;

            // Position label outside the box with better spacing
            const labelX = isLeftSide
              ? x - 12  // Left side: label to the left with more space
              : isRightSide
                ? x + width + 12  // Right side: label to the right with more space
                : x + width / 2;  // Middle: label on top

            const labelY = isLeftSide || isRightSide
              ? y + height / 2  // Left/Right: vertically centered
              : y - 12;  // Middle: above the box with more space

            const textAnchor = isLeftSide
              ? 'end'  // Right-align for left side
              : isRightSide
                ? 'start'  // Left-align for right side
                : 'middle';  // Center for middle

            return (
              <g>
                {/* Color-coded rectangle */}
                <Rectangle
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={node.color}
                  stroke="#1f2937"
                  strokeWidth={2}
                  radius={4}
                />
                {/* Node label - positioned outside with background for readability */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={textAnchor}
                  dominantBaseline="middle"
                  fill="currentColor"
                  className="fill-gray-900 dark:fill-white"
                  fontWeight="700"
                  fontSize="14px"
                  style={{
                    pointerEvents: 'none',
                    textShadow: '0 0 3px rgba(255,255,255,0.8), 0 0 6px rgba(255,255,255,0.6)',
                  }}
                >
                  {node.name}
                </text>
              </g>
            );
          }}
          link={{ stroke: '#9ca3af', strokeOpacity: 0.3 }}
          nodePadding={60}
          margin={{ top: 30, right: 120, bottom: 30, left: 120 }}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </ResponsiveContainer>

      {/* Interactive Legend */}
      <div className="card p-4 bg-gray-50 dark:bg-gray-800">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Legend</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 dark:bg-green-600 rounded border-2 border-gray-700"></div>
            <div className="text-sm">
              <div className="font-medium text-gray-900 dark:text-white">Fuel Nuclides</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Starting materials</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded border-2 border-gray-700"></div>
            <div className="text-sm">
              <div className="font-medium text-gray-900 dark:text-white">Intermediates</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Created & consumed</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 dark:bg-orange-600 rounded border-2 border-gray-700"></div>
            <div className="text-sm">
              <div className="font-medium text-gray-900 dark:text-white">Final Products</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Not consumed further</div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p>💡 <strong>Flow width</strong> represents how often each reaction pathway occurs</p>
          <p>💡 <strong>Hover</strong> over flows to see detailed reaction information</p>
          <p>💡 <strong>Green checkmark</strong> in tooltip indicates feedback loop pathways</p>
        </div>
      </div>
    </div>
  );
}
