import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import cytoscape, { Core } from 'cytoscape';
// @ts-ignore - No types available for cytoscape-cose-bilkent
import coseBilkent from 'cytoscape-cose-bilkent';
import { ChevronDown, ChevronUp, Play, Pause, StopCircle, SkipForward, SkipBack, Gauge } from 'lucide-react';
import { detectCycles } from '../services/cycleDetector';
import type { NodeRole } from '../types';

/**
 * Linear interpolation helper
 */
function lerp(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

// Register the layout algorithm
cytoscape.use(coseBilkent);

interface Reaction {
  type: 'fusion' | 'twotwo';
  inputs: string[];
  outputs: string[];
  MeV: number;
  loop: number;
  neutrino: string;
}

interface CascadeNetworkDiagramProps {
  reactions: Reaction[];
  width?: string;
  height?: string;
}

/**
 * Role-based color scheme for nuclides
 */
const ROLE_COLORS: Record<NodeRole, string> = {
  fuel: '#4A90E2',        // Blue - initial fuel nuclides
  intermediate: '#F5A623', // Yellow/Orange - participates in reactions
  product: '#7ED321',      // Green - mostly appears as output
  stable: '#9B9B9B',       // Gray - terminal nodes (no outputs)
};

/**
 * Blend node color based on input/output ratio
 * Similar to periodic table heatmap approach
 * @param inputCount - Number of times nuclide appears as input
 * @param outputCount - Number of times nuclide appears as output
 * @returns RGB color string
 */
function getBlendedNodeColor(inputCount: number, outputCount: number): string {
  const total = inputCount + outputCount;
  if (total === 0) return ROLE_COLORS.intermediate;

  // Calculate ratio: 0 = pure input, 1 = pure output
  const ratio = outputCount / total;

  // Base colors (RGB values)
  const inputColor = { r: 74, g: 144, b: 226 };   // Blue (#4A90E2)
  const outputColor = { r: 126, g: 211, b: 33 };  // Green (#7ED321)

  // Blend colors based on ratio
  const r = lerp(inputColor.r, outputColor.r, ratio);
  const g = lerp(inputColor.g, outputColor.g, ratio);
  const b = lerp(inputColor.b, outputColor.b, ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Classify a nuclide's role in the reaction network
 */
function classifyNuclideRole(
  nuclideId: string,
  reactions: Reaction[],
  firstLoopInputs: Set<string>
): NodeRole {
  let appearsAsInput = 0;
  let appearsAsOutput = 0;
  let inFirstLoop = firstLoopInputs.has(nuclideId);

  reactions.forEach((reaction) => {
    if (reaction.inputs.includes(nuclideId)) appearsAsInput++;
    if (reaction.outputs.includes(nuclideId)) appearsAsOutput++;
  });

  // Fuel: Only in first loop as input, never produced
  if (inFirstLoop && appearsAsOutput === 0) {
    return 'fuel';
  }

  // Stable: Appears as output but never as input (terminal node)
  if (appearsAsOutput > 0 && appearsAsInput === 0) {
    return 'stable';
  }

  // Product: Mostly appears as output
  if (appearsAsOutput > appearsAsInput * 2) {
    return 'product';
  }

  // Intermediate: Active participant in reactions
  return 'intermediate';
}

/**
 * Get edge color based on energy (MeV)
 */
function getEdgeColor(meV: number): string {
  if (meV > 5) return '#00D084';   // Bright green - highly exothermic
  if (meV > 0) return '#7ED321';   // Green - exothermic
  if (meV > -5) return '#F5A623';  // Orange - slightly endothermic
  return '#D0021B';                 // Red - endothermic
}

/**
 * Build Cytoscape graph elements from cascade reactions
 */
function buildCytoscapeElements(
  reactions: Reaction[],
  maxPathways: number = 0
): {
  elements: cytoscape.ElementDefinition[];
  totalPathways: number;
  displayedPathways: number;
  nodeRoles: Map<string, NodeRole>;
} {
  // De-duplicate and aggregate pathways
  const pathwayMap = new Map<string, { count: number; type: string; avgMeV: number; loops: Set<number> }>();

  reactions.forEach((reaction) => {
    const pathwayKey = `${reaction.inputs.join('+')}→${reaction.outputs.join('+')}`;

    if (pathwayMap.has(pathwayKey)) {
      const existing = pathwayMap.get(pathwayKey)!;
      existing.count++;
      existing.avgMeV = (existing.avgMeV * (existing.count - 1) + reaction.MeV) / existing.count;
      existing.loops.add(reaction.loop);
    } else {
      pathwayMap.set(pathwayKey, {
        count: 1,
        type: reaction.type,
        avgMeV: reaction.MeV,
        loops: new Set([reaction.loop]),
      });
    }
  });

  const totalPathways = pathwayMap.size;

  // Sort by count and limit
  const sortedPathways = Array.from(pathwayMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const filteredPathways = maxPathways > 0 ? sortedPathways.slice(0, maxPathways) : sortedPathways;
  const limitedPathwayMap = new Map(filteredPathways);

  // Extract unique nuclides from filtered pathways
  const nuclideFrequency = new Map<string, number>();
  const firstLoopInputs = new Set<string>();

  // Find first loop inputs
  reactions.filter((r) => r.loop === 0 || r.loop === 1).forEach((r) => {
    r.inputs.forEach((n) => firstLoopInputs.add(n));
  });

  // Calculate input/output counts for proportional color blending
  const inputCounts = new Map<string, number>();
  const outputCounts = new Map<string, number>();

  limitedPathwayMap.forEach((pathway, key) => {
    const [inputs, outputs] = key.split('→');

    // Track input occurrences
    inputs.split('+').forEach((nuclide) => {
      inputCounts.set(nuclide, (inputCounts.get(nuclide) || 0) + pathway.count);
      nuclideFrequency.set(nuclide, (nuclideFrequency.get(nuclide) || 0) + pathway.count);
    });

    // Track output occurrences
    outputs.split('+').forEach((nuclide) => {
      outputCounts.set(nuclide, (outputCounts.get(nuclide) || 0) + pathway.count);
      nuclideFrequency.set(nuclide, (nuclideFrequency.get(nuclide) || 0) + pathway.count);
    });
  });

  // Classify nodes (still needed for role-based styling options)
  const nodeRoles = new Map<string, NodeRole>();
  nuclideFrequency.forEach((_, nuclideId) => {
    const role = classifyNuclideRole(nuclideId, reactions, firstLoopInputs);
    nodeRoles.set(nuclideId, role);
  });

  // Build nodes with input/output counts for color blending
  const nodes: cytoscape.ElementDefinition[] = Array.from(nuclideFrequency.entries()).map(
    ([nuclideId, frequency]) => {
      const role = nodeRoles.get(nuclideId)!;
      const baseSize = 30;
      const size = baseSize + Math.log(frequency + 1) * 10;
      const inputCount = inputCounts.get(nuclideId) || 0;
      const outputCount = outputCounts.get(nuclideId) || 0;

      return {
        data: {
          id: nuclideId,
          label: nuclideId,
          frequency,
          role,
          size,
          inputCount,
          outputCount,
        },
      };
    }
  );

  // Build edges
  const edges: cytoscape.ElementDefinition[] = [];
  let edgeId = 0;

  limitedPathwayMap.forEach((pathway, key) => {
    const [inputs, outputs] = key.split('→');
    const inputList = inputs.split('+');
    const outputList = outputs.split('+');
    const edgeColor = getEdgeColor(pathway.avgMeV);
    const strokeWidth = Math.min(8, 1 + Math.log(pathway.count + 1) * 1.5);

    // Determine if this pathway should be animated (top 20% by frequency)
    const animate = pathway.count > 5;

    if (pathway.type === 'fusion') {
      // Fusion: A + B → C
      edges.push({
        data: {
          id: `e${edgeId++}`,
          source: inputList[0],
          target: outputList[0],
          type: pathway.type,
          count: pathway.count,
          energy: pathway.avgMeV,
          width: strokeWidth,
          color: edgeColor,
          animate,
        },
      });

      // Secondary input (dashed)
      if (inputList[1] && inputList[1] !== inputList[0]) {
        edges.push({
          data: {
            id: `e${edgeId++}`,
            source: inputList[1],
            target: outputList[0],
            type: pathway.type,
            count: pathway.count,
            energy: pathway.avgMeV,
            width: Math.max(1, strokeWidth - 1),
            color: edgeColor,
            secondary: true,
            animate: false,
          },
        });
      }
    } else {
      // Two-to-two: A + B → C + D
      edges.push({
        data: {
          id: `e${edgeId++}`,
          source: inputList[0],
          target: outputList[0],
          type: pathway.type,
          count: pathway.count,
          energy: pathway.avgMeV,
          width: strokeWidth,
          color: edgeColor,
          animate,
        },
      });

      if (outputList[1]) {
        edges.push({
          data: {
            id: `e${edgeId++}`,
            source: inputList[0],
            target: outputList[1],
            type: pathway.type,
            count: pathway.count,
            energy: pathway.avgMeV,
            width: Math.max(1, strokeWidth - 1),
            color: edgeColor,
            secondary: true,
            animate: false,
          },
        });
      }
    }
  });

  return {
    elements: [...nodes, ...edges],
    totalPathways,
    displayedPathways: filteredPathways.length,
    nodeRoles,
  };
}

/**
 * Create Cytoscape stylesheet with smooth animations
 */
function createStylesheet(): any[] {
  return [
    // Node styles with proportional color blending and smooth transitions
    {
      selector: 'node',
      style: {
        'background-color': (ele: any) => {
          const inputCount = ele.data('inputCount') || 0;
          const outputCount = ele.data('outputCount') || 0;
          return getBlendedNodeColor(inputCount, outputCount);
        },
        width: (ele: any) => ele.data('size'),
        height: (ele: any) => ele.data('size'),
        label: (ele: any) => ele.data('label'),
        'font-size': 10,
        'font-weight': 'bold',
        color: '#333',
        'text-valign': 'center',
        'text-halign': 'center',
        'border-width': 2,
        'border-color': '#555',
        // Smooth transitions for all style changes
        'transition-property': 'background-color, border-color, border-width, width, height, opacity',
        'transition-duration': '0.5s',
        'transition-timing-function': 'ease-in-out',
      },
    },
    // New nodes (fade in effect)
    {
      selector: 'node.new',
      style: {
        'border-width': 4,
        'border-color': '#4A90E2',
      },
    },
    // Cycle nodes (highlighted)
    {
      selector: 'node.cycle',
      style: {
        'border-width': 3,
        'border-color': '#FF6B6B',
        'border-style': 'solid',
      },
    },
    // Edge styles with smooth transitions
    {
      selector: 'edge',
      style: {
        width: (ele: any) => ele.data('width'),
        'line-color': (ele: any) => ele.data('color'),
        'target-arrow-color': (ele: any) => ele.data('color'),
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        opacity: 0.7,
        // Smooth transitions for edges
        'transition-property': 'line-color, target-arrow-color, width, opacity',
        'transition-duration': '0.4s',
        'transition-timing-function': 'ease-in-out',
      },
    },
    // Secondary edges (dashed)
    {
      selector: 'edge[secondary]',
      style: {
        'line-style': 'dashed',
        opacity: 0.5,
      },
    },
    // Animated edges (flowing effect with scrolling dashes)
    {
      selector: 'edge[?animate]',
      style: {
        'line-style': 'dashed',
        'line-dash-pattern': [8, 4],
        'line-dash-offset': 24, // Creates scrolling effect when animated
        opacity: 0.85,
      },
    },
  ];
}

/**
 * Cascade Network Diagram with Cytoscape.js
 *
 * Force-directed graph visualization showing:
 * - Node colors by role (fuel/intermediate/product/stable)
 * - Edge colors by energy (green=exothermic, red=endothermic)
 * - Cycle detection and highlighting
 * - Interactive exploration
 */
export default function CascadeNetworkDiagram({
  reactions,
  width = '100%',
  height = '600px',
}: CascadeNetworkDiagramProps) {
  // Calculate max loop from reactions
  const maxLoop = useMemo(() => {
    if (reactions.length === 0) return 0;
    return Math.max(...reactions.map(r => r.loop));
  }, [reactions]);

  // State
  const [maxPathways, setMaxPathways] = useState(50); // Increased default for better initial view
  const [showFilters, setShowFilters] = useState(false); // Collapsed by default - timeline is primary control
  const [highlightCycles, setHighlightCycles] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);

  // Timeline animation state
  const [currentLoop, setCurrentLoop] = useState(0); // Start at beginning for Gource-like experience
  const [isPlaying, setIsPlaying] = useState(true); // Auto-play on mount
  const [playbackSpeed, setPlaybackSpeed] = useState(2); // 2x speed by default for smoother experience

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const previousElementIdsRef = useRef<Set<string>>(new Set());

  // Filter reactions up to current loop (show evolution)
  const filteredReactions = useMemo(() => {
    return reactions.filter(r => r.loop <= currentLoop);
  }, [reactions, currentLoop]);

  // Build graph data from filtered reactions
  const graphData = useMemo(
    () => buildCytoscapeElements(filteredReactions, maxPathways),
    [filteredReactions, maxPathways]
  );

  // Progressive loading
  const hasMorePathways = useMemo(
    () => graphData.displayedPathways < graphData.totalPathways,
    [graphData.displayedPathways, graphData.totalPathways]
  );

  const loadMorePathways = useCallback(() => {
    setMaxPathways((prev) => Math.min(prev + 30, 200));
  }, []);

  // Sync currentLoop when maxLoop changes (e.g., new cascade data)
  // Reset to beginning and start playing for Gource-like experience
  useEffect(() => {
    setCurrentLoop(0);
    setIsPlaying(true);
  }, [maxLoop]);

  // Timeline animation playback
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 1000 / playbackSpeed; // Speed controls interval
    const interval = setInterval(() => {
      setCurrentLoop((prev) => {
        if (prev >= maxLoop) {
          setIsPlaying(false); // Stop at end
          return maxLoop;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxLoop]);

  // Media control handlers
  const handlePlay = useCallback(() => {
    if (currentLoop >= maxLoop) {
      setCurrentLoop(0); // Reset to start if at end
    }
    setIsPlaying(true);
  }, [currentLoop, maxLoop]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentLoop(0);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentLoop(0);
    setIsPlaying(true);
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentLoop((prev) => Math.min(prev + 1, maxLoop));
  }, [maxLoop]);

  const handleStepBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentLoop((prev) => Math.max(prev - 1, 0));
  }, []);

  // Initialize Cytoscape with incremental updates
  useEffect(() => {
    if (!containerRef.current) return;

    const currentElementIds = new Set(
      graphData.elements.map(el => el.data.id).filter((id): id is string => id !== undefined)
    );
    const previousElementIds = previousElementIdsRef.current;

    // First-time initialization
    if (!cyRef.current) {
      const cy = cytoscape({
        container: containerRef.current,
        elements: graphData.elements,
        style: createStylesheet(),
        layout: {
          name: 'cose-bilkent',
          animate: 'end',
          animationDuration: 1000,
          nodeDimensionsIncludeLabels: true,
          idealEdgeLength: 100,
          nodeRepulsion: 8000,
          edgeElasticity: 0.45,
          numIter: 2500,
          gravity: 0.5, // Stronger pull toward center to prevent isolated nodes drifting away
          gravityRange: 2.0, // Tighter gravity range keeps disconnected components closer
        } as any,
        minZoom: 0.3,
        maxZoom: 3,
      });

      cyRef.current = cy;

      // Event handlers (only set once)
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        console.log('Node clicked:', node.data());
      });

      cy.on('tap', 'edge', (evt) => {
        const edge = evt.target;
        console.log('Edge clicked:', edge.data());
      });

      cy.on('mouseover', 'node', (evt) => {
        const node = evt.target;
        node.style('border-width', 4);
        node.connectedEdges().style('opacity', 1);
      });

      cy.on('mouseout', 'node', (evt) => {
        const node = evt.target;
        const isCycle = node.hasClass('cycle');
        node.style('border-width', isCycle ? 3 : 2);
        node.connectedEdges().style('opacity', 0.7);
      });

      // Store initial positions
      cy.ready(() => {
        cy.nodes().forEach(node => {
          const pos = node.position();
          nodePositionsRef.current.set(node.id(), { x: pos.x, y: pos.y });
        });
      });

      previousElementIdsRef.current = currentElementIds;
      return;
    }

    // Incremental update for existing instance
    const cy = cyRef.current;

    // Store current positions before making changes
    cy.nodes().forEach(node => {
      const pos = node.position();
      nodePositionsRef.current.set(node.id(), { x: pos.x, y: pos.y });
    });

    // Find elements to add and remove
    const toAdd: cytoscape.ElementDefinition[] = [];
    const toRemoveIds: string[] = [];

    graphData.elements.forEach(el => {
      if (el.data.id && !previousElementIds.has(el.data.id)) {
        toAdd.push(el);
      }
    });

    cy.elements().forEach(el => {
      if (!currentElementIds.has(el.id())) {
        toRemoveIds.push(el.id());
      }
    });

    // Batch updates for performance
    cy.batch(() => {
      // Remove old elements
      if (toRemoveIds.length > 0) {
        toRemoveIds.forEach(id => {
          cy.getElementById(id).remove();
          nodePositionsRef.current.delete(id);
        });
      }

      // Add new elements
      if (toAdd.length > 0) {
        const newElements = cy.add(toAdd);

        // Highlight new nodes with animation
        newElements.nodes().addClass('new');

        // Remove highlight after animation completes
        setTimeout(() => {
          newElements.nodes().removeClass('new');
        }, 1500);

        // Position new nodes near their connected nodes (better initial placement)
        newElements.nodes().forEach(node => {
          const savedPos = nodePositionsRef.current.get(node.id());
          if (savedPos) {
            // Existing node - restore position
            node.position(savedPos);
          } else {
            // New node - position near connected neighbors
            const neighbors = node.neighborhood('node');
            if (neighbors.length > 0) {
              // Average position of neighbors
              let avgX = 0;
              let avgY = 0;
              let count = 0;
              neighbors.forEach(neighbor => {
                const pos = neighbor.position();
                avgX += pos.x;
                avgY += pos.y;
                count++;
              });
              if (count > 0) {
                node.position({
                  x: avgX / count + (Math.random() - 0.5) * 50,
                  y: avgY / count + (Math.random() - 0.5) * 50,
                });
              }
            } else {
              // No neighbors YET (edges might be added later or connected nodes don't exist yet)
              // Use center of mass of existing nodes instead of extent
              const existingNodes = cy.nodes().filter(n => n.id() !== node.id());
              if (existingNodes.length > 0) {
                let totalX = 0;
                let totalY = 0;
                existingNodes.forEach(n => {
                  const pos = n.position();
                  totalX += pos.x;
                  totalY += pos.y;
                });
                const centerX = totalX / existingNodes.length;
                const centerY = totalY / existingNodes.length;

                // Place near center with significant random offset to prevent clustering
                node.position({
                  x: centerX + (Math.random() - 0.5) * 200,
                  y: centerY + (Math.random() - 0.5) * 200,
                });
              } else {
                // First node - place at origin
                node.position({ x: 0, y: 0 });
              }
            }
          }
        });

        // Run smooth layout on ALL nodes to resolve overlaps
        // Use current positions as starting points for organic transitions
        if (cy.nodes().length < 150) {
          cy.layout({
            name: 'cose-bilkent',
            animate: 'end', // Animate to final positions
            animationDuration: 800, // Longer, smoother animation
            animationEasing: 'ease-out', // Smooth deceleration
            nodeDimensionsIncludeLabels: true,
            idealEdgeLength: 100,
            nodeRepulsion: 8500,
            edgeElasticity: 0.45,
            numIter: 800,
            gravity: 0.5, // Stronger pull toward center to prevent isolated nodes drifting away
            gravityRange: 2.0, // Tighter gravity range keeps disconnected components closer
            fit: false, // Don't re-center viewport
            randomize: false, // Use current positions as starting point
          } as any).run();
        }

        // Store positions after layout completes (with buffer for animation)
        setTimeout(() => {
          cy.nodes().forEach(node => {
            const pos = node.position();
            nodePositionsRef.current.set(node.id(), { x: pos.x, y: pos.y });
          });
        }, 900);
      }
    });

    previousElementIdsRef.current = currentElementIds;

    // Cleanup only on unmount
    return () => {
      // Don't destroy - we'll reuse the instance
    };
  }, [graphData.elements]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, []);

  // Handle cycle highlighting
  useEffect(() => {
    if (!cyRef.current) return;

    if (highlightCycles) {
      const result = detectCycles(cyRef.current);
      setCycleCount(result.cycleCount);

      // Add cycle class to nodes
      result.cycleNuclides.forEach((nuclideId) => {
        cyRef.current!.getElementById(nuclideId).addClass('cycle');
      });
    } else {
      // Remove cycle class
      cyRef.current.nodes().removeClass('cycle');
      setCycleCount(0);
    }
  }, [highlightCycles, graphData.elements]);

  return (
    <div className="space-y-4">
      {/* Timeline Animation Controls - Prominent Gource-style */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750 rounded-lg border-2 border-blue-300 dark:border-blue-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Cascade Evolution Timeline
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Loop {currentLoop} of {maxLoop} • {filteredReactions.length} reactions visible
            </p>
          </div>
          <button
            onClick={handleRestart}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
            title="Restart animation from beginning"
          >
            <Play className="w-4 h-4" />
            Restart
          </button>
        </div>

        {/* Media Controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleStepBackward}
            disabled={currentLoop === 0}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Step backward"
          >
            <SkipBack className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>

          <button
            onClick={handleStop}
            disabled={currentLoop === 0 && !isPlaying}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Stop (reset to beginning)"
          >
            <StopCircle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>

          {isPlaying ? (
            <button
              onClick={handlePause}
              className="p-2 rounded bg-blue-500 hover:bg-blue-600 text-white"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={currentLoop >= maxLoop && maxLoop > 0}
              className="p-2 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Play"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleStepForward}
            disabled={currentLoop >= maxLoop}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Step forward"
          >
            <SkipForward className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>

          {/* Playback Speed */}
          <div className="ml-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>
          </div>
        </div>

        {/* Loop Scrubber Slider */}
        <div>
          <input
            id="loop-scrubber"
            type="range"
            min="0"
            max={maxLoop}
            step="1"
            value={currentLoop}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentLoop(Number(e.target.value));
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
            <span>Loop 0</span>
            <span>Loop {maxLoop}</span>
          </div>
        </div>
      </div>

      {/* Advanced Settings (collapsed by default) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 rounded px-2 py-1 transition-colors"
          aria-label={showFilters ? 'Hide advanced settings' : 'Show advanced settings'}
        >
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Advanced Settings</h3>
          {showFilters ? (
            <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-500" />
          )}
        </button>

        {showFilters && (
          <div className="space-y-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {/* Pathway Limit Slider - Enhanced granularity */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="max-pathways" className="text-sm text-gray-600 dark:text-gray-400">
                  Maximum Pathways
                </label>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {maxPathways === 0 ? 'All' : maxPathways}
                </span>
              </div>
              <input
                id="max-pathways"
                type="range"
                min="1"
                max="200"
                step="1"
                value={maxPathways}
                onChange={(e) => setMaxPathways(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
                <span>1</span>
                <span>200</span>
              </div>
            </div>

            {/* Cycle Detection Toggle */}
            <div className="flex items-center justify-between">
              <label htmlFor="highlight-cycles" className="text-sm text-gray-600 dark:text-gray-400">
                Highlight Feedback Cycles
              </label>
              <input
                id="highlight-cycles"
                type="checkbox"
                checked={highlightCycles}
                onChange={(e) => setHighlightCycles(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setMaxPathways(200)}
                disabled={maxPathways >= 200}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Show All
              </button>
              <button
                onClick={() => setMaxPathways(30)}
                disabled={maxPathways <= 30}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{graphData.displayedPathways}</span> of{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-300">{graphData.totalPathways}</span> pathways
            {graphData.displayedPathways < graphData.totalPathways && (
              <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">(sorted by frequency)</span>
            )}
          </p>
          {highlightCycles && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Detected{' '}
              <span className="font-semibold text-red-600 dark:text-red-400">{cycleCount}</span> feedback{' '}
              {cycleCount === 1 ? 'cycle' : 'cycles'}
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Node Colors:</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ROLE_COLORS).map(([role, color]) => (
              <div key={role} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-gray-400" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Network Graph */}
      <div
        ref={containerRef}
        style={{ width, height }}
        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
      />

      {/* Load More Button */}
      {hasMorePathways && maxPathways < 200 && (
        <div className="flex justify-center">
          <button
            onClick={loadMorePathways}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
          >
            Load More Pathways (+30)
          </button>
        </div>
      )}
    </div>
  );
}
