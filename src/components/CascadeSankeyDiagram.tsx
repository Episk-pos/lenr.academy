import { useState } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { Sliders, HelpCircle, X } from 'lucide-react';
import type { PathwayAnalysis } from '../services/pathwayAnalyzer';
import { SankeyErrorBoundary } from './SankeyErrorBoundary';

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
 * Extract atomic number and mass number from nuclide ID
 * e.g., "He-4" → { element: "He", Z: 2, A: 4 }
 */
function parseNuclide(nuclideId: string): { element: string; Z: number; A: number } {
  const match = nuclideId.match(/^([A-Z][a-z]?)[-\s]?(\d+)$/);
  if (!match) return { element: nuclideId, Z: 0, A: 0 };

  const element = match[1];
  const A = parseInt(match[2]);

  // Map common elements to Z (atomic number)
  const elementToZ: Record<string, number> = {
    'H': 1, 'D': 1, 'T': 1, 'He': 2, 'Li': 3, 'Be': 4, 'B': 5, 'C': 6, 'N': 7, 'O': 8,
    'F': 9, 'Ne': 10, 'Na': 11, 'Mg': 12, 'Al': 13, 'Si': 14, 'P': 15, 'S': 16,
    'Cl': 17, 'Ar': 18, 'K': 19, 'Ca': 20, 'Fe': 26, 'Ni': 28, 'Cu': 29, 'Zn': 30
  };

  const Z = elementToZ[element] || 0;
  return { element, Z, A };
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

  // Sort pathways to minimize crossings in Sankey diagram
  // Group by: 1) output element/mass, 2) input element/mass
  const sortedPathways = [...pathways].sort((a, b) => {
    // Parse first output of each pathway
    const aOut = parseNuclide(a.outputs[0]);
    const bOut = parseNuclide(b.outputs[0]);

    // Sort by output Z (atomic number) first
    if (aOut.Z !== bOut.Z) return aOut.Z - bOut.Z;

    // Then by output A (mass number)
    if (aOut.A !== bOut.A) return aOut.A - bOut.A;

    // Then by input Z
    const aIn = parseNuclide(a.inputs[0]);
    const bIn = parseNuclide(b.inputs[0]);
    if (aIn.Z !== bIn.Z) return aIn.Z - bIn.Z;

    // Finally by input A
    return aIn.A - bIn.A;
  });

  // Build node list and index map with type classification
  sortedPathways.forEach((pathway) => {
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

  // Build aggregated links - consolidate duplicate connections
  // Map from "sourceIndex-targetIndex" to aggregated link data
  const linkMap = new Map<string, {
    source: number;
    target: number;
    value: number;
    pathways: PathwayAnalysis[];
  }>();

  sortedPathways.forEach((pathway) => {
    // For each pathway, create connections from inputs to outputs
    // For two-to-two reactions (A + B → C + D), we create all possible links
    const numInputs = pathway.inputs.length;
    const numOutputs = pathway.outputs.length;
    const valuePerLink = pathway.frequency / Math.max(numInputs, numOutputs);

    // Create links from each input to corresponding outputs
    for (let i = 0; i < Math.max(numInputs, numOutputs); i++) {
      const inputIndex = i < numInputs ? i : 0; // Use first input if we run out
      const outputIndex = i < numOutputs ? i : 0; // Use first output if we run out

      const sourceIndex = nodeMap.get(pathway.inputs[inputIndex]);
      const targetIndex = nodeMap.get(pathway.outputs[outputIndex]);

      if (sourceIndex !== undefined && targetIndex !== undefined) {
        const linkKey = `${sourceIndex}-${targetIndex}`;

        if (linkMap.has(linkKey)) {
          // Aggregate with existing link
          const existing = linkMap.get(linkKey)!;
          existing.value += valuePerLink;
          existing.pathways.push(pathway);
        } else {
          // Create new aggregated link
          linkMap.set(linkKey, {
            source: sourceIndex,
            target: targetIndex,
            value: valuePerLink,
            pathways: [pathway],
          });
        }
      }
    }
  });

  // Convert aggregated links to array
  // Use the most frequent pathway for tooltip display
  linkMap.forEach(({ source, target, value, pathways }) => {
    links.push({
      source,
      target,
      value,
      pathway: pathways.sort((a, b) => b.frequency - a.frequency)[0], // Show most frequent pathway in tooltip
    });
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
  const [topN, setTopN] = useState(15);
  const [feedbackOnly, setFeedbackOnly] = useState(false);
  const [minFrequency, setMinFrequency] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(() => {
    // Show guide on first visit
    const hasSeenGuide = localStorage.getItem('cascade-sankey-guide-seen');
    return !hasSeenGuide;
  });

  // Safety: Clamp topN to max of 30 to prevent stack overflow
  // Note: Even 30 pathways can create 60+ nodes and links which strains Recharts
  const safeTopN = Math.min(topN, 30);

  const handleCloseGuide = () => {
    localStorage.setItem('cascade-sankey-guide-seen', 'true');
    setShowGuide(false);
  };

  // Apply filters and track counts for user feedback
  let filteredPathways = [...pathways];
  const totalPathways = pathways.length;

  // Track filter effects
  let afterFeedbackFilter = filteredPathways.length;
  let afterFrequencyFilter = filteredPathways.length;

  if (feedbackOnly) {
    filteredPathways = filteredPathways.filter((p) => p.isFeedback);
    afterFeedbackFilter = filteredPathways.length;
  }

  if (minFrequency > 1) {
    filteredPathways = filteredPathways.filter((p) => p.frequency >= minFrequency);
    afterFrequencyFilter = filteredPathways.length;
  }

  // Sort by frequency (descending) to ensure "Top N" shows the most frequent
  filteredPathways.sort((a, b) => b.frequency - a.frequency);

  // Limit to top N (using safe clamped value)
  const beforeTopNLimit = filteredPathways.length;
  filteredPathways = filteredPathways.slice(0, safeTopN);

  // Convert to Sankey format with color coding
  let sankeyData;
  let nodeCountExceeded = false;
  try {
    sankeyData = pathwaysToSankeyData(filteredPathways, fuelNuclides);

    // Additional safety check: limit total node count to prevent stack overflow
    // Recharts Sankey can overflow with >50 nodes even with good pathway limits
    const MAX_NODES = 50;
    if (sankeyData.nodes.length > MAX_NODES) {
      nodeCountExceeded = true;
      // Calculate how many pathways we can safely show
      // Binary search would be ideal, but simple reduction works
      let reducedPathways = Math.floor(filteredPathways.length * 0.6);
      let attempts = 0;

      while (attempts < 5 && sankeyData.nodes.length > MAX_NODES && reducedPathways > 5) {
        const testPathways = filteredPathways.slice(0, reducedPathways);
        sankeyData = pathwaysToSankeyData(testPathways, fuelNuclides);

        if (sankeyData.nodes.length <= MAX_NODES) {
          filteredPathways = testPathways;
          nodeCountExceeded = false;
          break;
        }

        reducedPathways = Math.floor(reducedPathways * 0.7);
        attempts++;
      }

      if (nodeCountExceeded) {
        setRenderError(`Too many unique nuclides (${sankeyData.nodes.length}) to display safely. Try using filters to reduce complexity.`);
        sankeyData = { nodes: [], links: [] };
      }
    }

    // Clear any previous errors if successful
    if (!nodeCountExceeded && renderError) setRenderError(null);
  } catch (error) {
    console.error('Error generating Sankey data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error generating diagram';
    // Check if it's a stack overflow
    if (message.includes('stack') || message.includes('Maximum call stack')) {
      setRenderError('Diagram too complex - exceeded rendering limits. Please reduce the number of pathways or use filters.');
    } else {
      setRenderError(message);
    }
    sankeyData = { nodes: [], links: [] }; // Empty fallback
  }

  // Calculate max frequency for color scaling
  const maxFrequency = Math.max(...pathways.map((p) => p.frequency), 1);

  // Calculate min/max for link width scaling
  const linkValues = sankeyData.links.map(l => l.value);
  const minValue = Math.min(...linkValues);
  const maxValue = Math.max(...linkValues);

  // Custom link renderer with variable width based on pathway frequency
  const CustomLink = (props: any) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, index } = props;
    const linkData = sankeyData.links[index];

    // Calculate thickness from pathway frequency value
    // Normalize value to get thickness between 2 and 30 pixels
    const normalizedValue = maxValue > minValue
      ? (linkData.value - minValue) / (maxValue - minValue)
      : 0.5;
    const thickness = 2 + (normalizedValue * 28); // 2-30px range
    const halfThickness = thickness / 2;

    const pathD = `
      M${sourceX},${sourceY - halfThickness}
      C${sourceControlX},${sourceY - halfThickness} ${targetControlX},${targetY - halfThickness} ${targetX},${targetY - halfThickness}
      L${targetX},${targetY + halfThickness}
      C${targetControlX},${targetY + halfThickness} ${sourceControlX},${sourceY + halfThickness} ${sourceX},${sourceY + halfThickness}
      Z
    `;

    const pathway = linkData.pathway as PathwayAnalysis;
    const tooltipText = pathway ?
      `${pathway.pathway}\nType: ${pathway.type === 'fusion' ? 'Fusion' : 'Two-to-Two'}\nFrequency: ×${pathway.frequency}\nAvg Energy: ${pathway.avgEnergy.toFixed(2)} MeV${pathway.isFeedback ? '\n✓ Feedback Loop' : ''}`
      : '';

    return (
      <g>
        <title>{tooltipText}</title>
        {/* Visible path */}
        <path
          d={pathD}
          fill="#9ca3af"
          fillOpacity={0.4}
          stroke="none"
          pointerEvents="none"
        />
        {/* Invisible larger hitbox for tooltips */}
        <path
          d={pathD}
          fill="transparent"
          stroke="transparent"
          strokeWidth={Math.max(thickness, 10)}
          style={{ cursor: 'pointer' }}
          pointerEvents="all"
        />
      </g>
    );
  };

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
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showGuide ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
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
      </div>

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

      {/* Filter Controls */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="card p-3 space-y-3 bg-gray-50 dark:bg-gray-800">
          {/* Top N Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Show Top Pathways: {topN}
            </label>
            <input
              type="range"
              min="5"
              max="30"
              step="5"
              value={Math.min(topN, 30)}
              onChange={(e) => setTopN(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>5</span>
              <span>30 (max)</span>
            </div>
            {topN > 20 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                ⚠️ High pathway counts may cause slow rendering or errors
              </p>
            )}
          </div>

          {/* Min Frequency Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
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
      </div>

      {/* Filter Status Message */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>
          Showing <strong>{filteredPathways.length}</strong> of <strong>{totalPathways}</strong> total pathways
          {beforeTopNLimit > safeTopN && (
            <span className="text-gray-500"> (top {safeTopN} by frequency)</span>
          )}
        </p>
        {(minFrequency > 1 || feedbackOnly) && (
          <p className="text-xs mt-1">
            Filters applied:
            {feedbackOnly && <span> • Feedback loops only ({afterFeedbackFilter} matched)</span>}
            {minFrequency > 1 && (
              <span> • Min frequency ≥{minFrequency}× ({afterFrequencyFilter} matched)</span>
            )}
          </p>
        )}
      </div>

      {/* Error Message */}
      {renderError && (
        <div className="card p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-400">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                Diagram Rendering Error
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                The Sankey diagram encountered an error while rendering. This usually happens with too many pathways.
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                Try reducing the number of pathways or using filters to simplify the data.
              </p>
              <details className="mt-2">
                <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer">Technical details</summary>
                <pre className="text-xs text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">{renderError}</pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Sankey Diagram */}
      {!renderError && sankeyData.nodes.length > 0 && (
        <div className="overflow-hidden rounded-lg">
          <SankeyErrorBoundary
            onError={(error) => {
              console.error('Sankey Error Boundary caught:', error);
              const message = error.message || String(error);
              if (message.includes('stack') || message.includes('Maximum call stack')) {
                setRenderError('Stack overflow - diagram too complex. Please reduce the number of pathways using filters.');
              } else {
                setRenderError(`Rendering error: ${message}. Try reducing complexity with filters.`);
              }
            }}
          >
            <ResponsiveContainer width="100%" height={500}>
            <Sankey
              key={`${safeTopN}-${minFrequency}-${feedbackOnly}`}
              data={sankeyData}
              link={CustomLink}
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

            const nodeTypeLabel = node.type === 'fuel' ? 'Fuel Nuclide' :
                                  node.type === 'final' ? 'Final Product' :
                                  'Intermediate Product';
            const tooltipText = `${node.name}\n${nodeTypeLabel}`;

            return (
              <g>
                <title>{tooltipText}</title>
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
          nodePadding={60}
          margin={{ top: 30, right: 120, bottom: 30, left: 120 }}
        >
          <Tooltip content={<CustomTooltip />} />
        </Sankey>
      </ResponsiveContainer>
        </SankeyErrorBoundary>
        </div>
      )}

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
        </div>
      </div>
    </div>
  );
}
