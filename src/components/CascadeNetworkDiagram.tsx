import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3-selection';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';
import { easeCubicOut } from 'd3-ease';
import { Play, Pause, StopCircle, SkipForward, SkipBack, Gauge, ChevronDown, ChevronUp, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { NodeRole } from '../types';

/**
 * Reaction data structure from cascade results
 */
interface Reaction {
  type: 'fusion' | 'twotwo';
  inputs: string[];
  outputs: string[];
  MeV: number;
  loop: number;
  neutrino: string;
}

/**
 * D3 Force Simulation Node
 */
interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;

  // Activity tracking
  firstLoop: number;
  lastActiveLoop: number;
  isActive: boolean;
  recency: number;  // 1.0 = current loop, decays over time

  // Visual properties
  size: number;
  inputCount: number;
  outputCount: number;
  role: NodeRole;
  frequency: number;
}

/**
 * D3 Force Simulation Link
 */
interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;

  // Activity tracking
  firstLoop: number;
  isActive: boolean;

  // Visual properties
  type: 'fusion' | 'twotwo';
  energy: number;  // MeV
  frequency: number;
  width: number;
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
 */
function getBlendedNodeColor(inputCount: number, outputCount: number): string {
  const total = inputCount + outputCount;
  if (total === 0) return ROLE_COLORS.intermediate;

  const ratio = outputCount / total;

  // Lerp between blue (input) and green (output)
  const inputColor = { r: 74, g: 144, b: 226 };
  const outputColor = { r: 126, g: 211, b: 33 };

  const r = Math.round(inputColor.r + (outputColor.r - inputColor.r) * ratio);
  const g = Math.round(inputColor.g + (outputColor.g - inputColor.g) * ratio);
  const b = Math.round(inputColor.b + (outputColor.b - inputColor.b) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Get edge color based on energy (MeV) with brightness variations
 * More exothermic = brighter green, more endothermic = dimmer red
 */
function getEdgeColor(meV: number): string {
  // Calculate brightness based on energy magnitude
  const brightness = Math.min(1.0, 0.3 + Math.abs(meV) / 20);

  if (meV > 0) {
    // Exothermic - green with brightness based on energy
    return `rgba(126, 211, 33, ${brightness})`;
  } else {
    // Endothermic - red with reduced brightness
    return `rgba(208, 2, 27, ${brightness * 0.5})`;
  }
}

/**
 * Classify a nuclide's role in the reaction network
 */
function classifyNuclideRole(
  nuclideId: string,
  allReactions: Reaction[],
  firstLoopInputs: Set<string>
): NodeRole {
  let appearsAsInput = 0;
  let appearsAsOutput = 0;
  const inFirstLoop = firstLoopInputs.has(nuclideId);

  allReactions.forEach((reaction) => {
    if (reaction.inputs.includes(nuclideId)) appearsAsInput++;
    if (reaction.outputs.includes(nuclideId)) appearsAsOutput++;
  });

  if (inFirstLoop && appearsAsOutput === 0) return 'fuel';
  if (appearsAsOutput > 0 && appearsAsInput === 0) return 'stable';
  if (appearsAsOutput > appearsAsInput * 2) return 'product';
  return 'intermediate';
}

/**
 * Build clean graph data with activity tracking
 * NO ORPHANED NODES - filters pathways first, then builds graph
 */
function buildGraphData(
  reactions: Reaction[],
  currentLoop: number,
  maxPathways: number = 0
): {
  nodes: GraphNode[];
  links: GraphLink[];
  activeNodeIds: Set<string>;
} {
  // Phase 1: Aggregate and filter pathways by frequency
  const pathwayMap = new Map<string, {
    count: number;
    type: 'fusion' | 'twotwo';
    avgMeV: number;
    loops: Set<number>;
    firstLoop: number;
    lastLoop: number;
  }>();

  reactions.forEach((reaction) => {
    const pathwayKey = `${reaction.inputs.join('+')}→${reaction.outputs.join('+')}`;

    if (pathwayMap.has(pathwayKey)) {
      const existing = pathwayMap.get(pathwayKey)!;
      existing.count++;
      existing.avgMeV = (existing.avgMeV * (existing.count - 1) + reaction.MeV) / existing.count;
      existing.loops.add(reaction.loop);
      existing.lastLoop = Math.max(existing.lastLoop, reaction.loop);
    } else {
      pathwayMap.set(pathwayKey, {
        count: 1,
        type: reaction.type,
        avgMeV: reaction.MeV,
        loops: new Set([reaction.loop]),
        firstLoop: reaction.loop,
        lastLoop: reaction.loop,
      });
    }
  });

  // Filter: only pathways that have appeared by currentLoop
  const sortedPathways = Array.from(pathwayMap.entries())
    .filter(([_, pathway]) => pathway.firstLoop <= currentLoop)
    .sort((a, b) => b[1].count - a[1].count);

  const filteredPathways = maxPathways > 0 ? sortedPathways.slice(0, maxPathways) : sortedPathways;

  // Phase 2: Build node activity tracking from FILTERED pathways only
  const nodeActivity = new Map<string, {
    firstLoop: number;
    lastLoop: number;
    inputCount: number;
    outputCount: number;
    activeLoops: Set<number>;
  }>();

  const firstLoopInputs = new Set<string>();
  reactions.filter((r) => r.loop === 0 || r.loop === 1).forEach((r) => {
    r.inputs.forEach((n) => firstLoopInputs.add(n));
  });

  // Track activity only for nodes in filtered pathways
  filteredPathways.forEach(([key, pathway]) => {
    const [inputs, outputs] = key.split('→');

    pathway.loops.forEach(loop => {
      if (loop > currentLoop) return;

      inputs.split('+').forEach((nuclide) => {
        if (!nodeActivity.has(nuclide)) {
          nodeActivity.set(nuclide, {
            firstLoop: loop,
            lastLoop: loop,
            inputCount: 0,
            outputCount: 0,
            activeLoops: new Set(),
          });
        }
        const activity = nodeActivity.get(nuclide)!;
        activity.lastLoop = Math.max(activity.lastLoop, loop);
        activity.inputCount += pathway.count;
        activity.activeLoops.add(loop);
      });

      outputs.split('+').forEach((nuclide) => {
        if (!nodeActivity.has(nuclide)) {
          nodeActivity.set(nuclide, {
            firstLoop: loop,
            lastLoop: loop,
            inputCount: 0,
            outputCount: 0,
            activeLoops: new Set(),
          });
        }
        const activity = nodeActivity.get(nuclide)!;
        activity.lastLoop = Math.max(activity.lastLoop, loop);
        activity.outputCount += pathway.count;
        activity.activeLoops.add(loop);
      });
    });
  });

  // Calculate recency score (exponential decay)
  const calculateRecency = (lastLoop: number): number => {
    const loopsSinceActive = currentLoop - lastLoop;
    if (loopsSinceActive === 0) return 1.0;
    return Math.max(0.2, Math.exp(-loopsSinceActive / 3));
  };

  // Phase 3: Build D3 nodes
  const activeNodeIds = new Set<string>();
  const nodes: GraphNode[] = Array.from(nodeActivity.entries()).map(
    ([nuclideId, activity]) => {
      const role = classifyNuclideRole(nuclideId, reactions, firstLoopInputs);
      const isActive = activity.activeLoops.has(currentLoop);
      if (isActive) activeNodeIds.add(nuclideId);

      const recency = calculateRecency(activity.lastLoop);
      const baseSize = 30;
      const frequency = activity.inputCount + activity.outputCount;
      const size = baseSize + Math.log(frequency + 1) * 10;

      return {
        id: nuclideId,
        label: nuclideId,
        firstLoop: activity.firstLoop,
        lastActiveLoop: activity.lastLoop,
        isActive,
        recency,
        size,
        inputCount: activity.inputCount,
        outputCount: activity.outputCount,
        role,
        frequency,
      };
    }
  );

  // Phase 4: Build D3 links
  const links: GraphLink[] = [];
  filteredPathways.forEach(([key, pathway]) => {
    const [inputs, outputs] = key.split('→');
    const inputList = inputs.split('+');
    const outputList = outputs.split('+');

    const isActive = pathway.loops.has(currentLoop);
    const strokeWidth = Math.min(8, 1 + Math.log(pathway.count + 1) * 1.5);

    if (pathway.type === 'fusion') {
      // Fusion: A + B → C
      links.push({
        source: inputList[0],
        target: outputList[0],
        type: pathway.type,
        frequency: pathway.count,
        energy: pathway.avgMeV,
        width: strokeWidth,
        firstLoop: pathway.firstLoop,
        isActive,
      });

      // Secondary input (if different)
      if (inputList[1] && inputList[1] !== inputList[0]) {
        links.push({
          source: inputList[1],
          target: outputList[0],
          type: pathway.type,
          frequency: pathway.count,
          energy: pathway.avgMeV,
          width: Math.max(1, strokeWidth - 1),
          firstLoop: pathway.firstLoop,
          isActive,
        });
      }
    } else {
      // Two-to-two: A + B → C + D
      links.push({
        source: inputList[0],
        target: outputList[0],
        type: pathway.type,
        frequency: pathway.count,
        energy: pathway.avgMeV,
        width: strokeWidth,
        firstLoop: pathway.firstLoop,
        isActive,
      });

      if (outputList[1]) {
        links.push({
          source: inputList[0],
          target: outputList[1],
          type: pathway.type,
          frequency: pathway.count,
          energy: pathway.avgMeV,
          width: Math.max(1, strokeWidth - 1),
          firstLoop: pathway.firstLoop,
          isActive,
        });
      }
    }
  });

  return { nodes, links, activeNodeIds };
}

/**
 * Cascade Network Diagram - D3 Force-Directed Graph
 *
 * Gource-inspired real-time visualization with:
 * - Continuous physics simulation (never stops!)
 * - Activity-based fading (recent = bright, old = dim)
 * - Auto camera following
 * - Rich visual effects
 */
export default function CascadeNetworkDiagram({
  reactions,
  width = '100%',
  height = '600px',
}: CascadeNetworkDiagramProps) {
  // Calculate max loop
  const maxLoop = Math.max(...reactions.map(r => r.loop), 0);

  // State
  const [currentLoop, setCurrentLoop] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [maxPathways, setMaxPathways] = useState(50);
  const [showFilters, setShowFilters] = useState(false);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<any>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Media control handlers
  const handlePlay = useCallback(() => {
    if (currentLoop >= maxLoop) setCurrentLoop(0);
    setIsPlaying(true);
  }, [currentLoop, maxLoop]);

  const handlePause = useCallback(() => setIsPlaying(false), []);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
    setCurrentLoop(0);
  }, []);

  const handleStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentLoop(prev => Math.min(prev + 1, maxLoop));
  }, [maxLoop]);

  const handleStepBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentLoop(prev => Math.max(prev - 1, 0));
  }, []);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy as any, 1.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy as any, 0.7);
  }, []);

  const handleZoomReset = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(
      zoomBehaviorRef.current.transform as any,
      zoomIdentity
    );
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentLoop(0);
    setIsPlaying(true);
  }, []);

  // Timeline playback
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 1000 / playbackSpeed;
    const interval = setInterval(() => {
      setCurrentLoop(prev => {
        if (prev >= maxLoop) {
          setIsPlaying(false);
          return maxLoop;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxLoop]);

  // Reset on new cascade data
  useEffect(() => {
    setCurrentLoop(0);
    setIsPlaying(false);  // Don't auto-play
  }, [maxLoop]);

  // Build graph data
  const graphData = buildGraphData(reactions, currentLoop, maxPathways);

  // Initialize and update D3 force simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (graphData.nodes.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Initialize simulation (continuous physics!)
    if (!simulationRef.current) {
      // Initialize all nodes at center with random offset to avoid "flying in from top-left"
      graphData.nodes.forEach(node => {
        node.x = width / 2 + (Math.random() - 0.5) * 200;
        node.y = height / 2 + (Math.random() - 0.5) * 200;
        node.vx = 0;
        node.vy = 0;
      });

      const simulation = forceSimulation(graphData.nodes)
        .force('link', forceLink<GraphNode, GraphLink>(graphData.links)
          .id(d => d.id)
          .distance(100)
          .strength(0.3)
        )
        .force('charge', forceManyBody().strength(-150))
        .force('center', forceCenter(width / 2, height / 2).strength(0.03))
        .force('collision', forceCollide<GraphNode>().radius(d => d.size + 5))
        .alphaMin(0.001)  // Cool down but maintain subtle motion
        .alphaDecay(0.02)  // Slow cooldown
        .velocityDecay(0.6);  // More friction for stability

      simulationRef.current = simulation;
    } else {
      // Update existing simulation with new data
      const sim = simulationRef.current;

      // Preserve positions of existing nodes
      const oldNodes = sim.nodes();
      const positionMap = new Map(oldNodes.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]));

      // Transfer positions to new nodes, initialize new nodes at center with random offset
      graphData.nodes.forEach(node => {
        const oldPos = positionMap.get(node.id);
        if (oldPos) {
          // Existing node - preserve position
          node.x = oldPos.x;
          node.y = oldPos.y;
          node.vx = oldPos.vx;
          node.vy = oldPos.vy;
        } else {
          // New node - initialize at center with random offset to avoid "flying in from top-left"
          node.x = width / 2 + (Math.random() - 0.5) * 200;
          node.y = height / 2 + (Math.random() - 0.5) * 200;
          node.vx = 0;
          node.vy = 0;
        }
      });

      sim.nodes(graphData.nodes);
      sim.force('link').links(graphData.links);
      sim.alpha(0.05).restart();  // Very gentle restart for smooth loop transitions
    }

    // Setup SVG
    const svg = d3.select(svgRef.current);

    // Preserve current transform if it exists
    const graphContainer = svg.select('g.graph-container');
    const currentTransform = graphContainer.empty() ? null : graphContainer.attr('transform');

    svg.selectAll('*').remove();  // Clear

    // Create groups for edges and nodes
    const g = svg.append('g').attr('class', 'graph-container');

    // Restore previous transform if it existed
    if (currentTransform) {
      g.attr('transform', currentTransform);
    }

    const edgesGroup = g.append('g').attr('class', 'edges');
    const nodesGroup = g.append('g').attr('class', 'nodes');

    // Render edges with transitions
    const edgeElements = edgesGroup
      .selectAll('line')
      .data(graphData.links, (d: any) => `${d.source.id}-${d.target.id}`)
      .join(
        enter => enter.append('line')
          .attr('stroke', d => getEdgeColor(d.energy))
          .attr('stroke-width', d => d.width)
          .attr('stroke-opacity', 0)
          .attr('marker-end', d => d.isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'),
        update => update,
        exit => exit.transition().duration(300).attr('stroke-opacity', 0).remove()
      )
      .transition()
      .duration(500)
      .attr('stroke', d => getEdgeColor(d.energy))
      .attr('stroke-width', d => d.width)
      .attr('stroke-opacity', d => d.isActive ? 0.8 : 0.3)
      .attr('marker-end', d => d.isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)')
      .selection();

    // Render nodes
    const nodeElements = nodesGroup
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'node')
      .call(drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulationRef.current.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulationRef.current.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any
      );

    // Node circles - update existing or create new
    const circles = nodeElements.selectAll('circle')
      .data(d => [d])
      .join('circle')
      .attr('r', d => d.size / 2);

    // Animate circle properties with transitions
    circles
      .transition()
      .duration(500)
      .attr('fill', d => getBlendedNodeColor(d.inputCount, d.outputCount))
      .attr('fill-opacity', d => 0.3 + 0.7 * d.recency)
      .attr('stroke', d => d.isActive ? '#FFD700' : '#555')
      .attr('stroke-width', d => d.isActive ? 4 : 2)
      .attr('filter', d => {
        if (d.isActive) return 'url(#active-glow)';
        if (d.recency > 0.6) return 'url(#recent-glow)';
        return 'none';
      });

    // Node labels - update existing or create new
    const labels = nodeElements.selectAll('text')
      .data(d => [d])
      .join('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.size / 2 + 12)
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', 'currentColor')
      .attr('class', 'text-gray-900 dark:text-gray-100');

    // Animate label opacity
    labels
      .transition()
      .duration(500)
      .attr('opacity', d => 0.3 + 0.7 * d.recency);

    // Hover interactions - highlight node and its connections
    nodeElements
      .on('mouseenter', function(event, d) {
        // Find connected edges
        const connectedEdges = graphData.links.filter(l =>
          (l.source as GraphNode).id === d.id || (l.target as GraphNode).id === d.id
        );
        const connectedNodeIds = new Set<string>();
        connectedEdges.forEach(e => {
          connectedNodeIds.add((e.source as GraphNode).id);
          connectedNodeIds.add((e.target as GraphNode).id);
        });

        // Fade non-connected elements
        nodeElements
          .transition()
          .duration(200)
          .style('opacity', node => connectedNodeIds.has(node.id) ? 1.0 : 0.2);

        edgeElements
          .transition()
          .duration(200)
          .style('opacity', edge => {
            const sourceId = (edge.source as GraphNode).id;
            const targetId = (edge.target as GraphNode).id;
            return (sourceId === d.id || targetId === d.id) ? 1.0 : 0.1;
          });

        // Highlight hovered node
        d3.select(this)
          .select('circle')
          .transition()
          .duration(200)
          .attr('stroke-width', 6)
          .attr('stroke', '#FFD700');
      })
      .on('mouseleave', function() {
        // Restore all elements
        nodeElements
          .transition()
          .duration(200)
          .style('opacity', null);

        edgeElements
          .transition()
          .duration(200)
          .style('opacity', null);

        // Restore node stroke
        nodeElements.selectAll('circle')
          .transition()
          .duration(200)
          .attr('stroke-width', d => d.isActive ? 4 : 2)
          .attr('stroke', d => d.isActive ? '#FFD700' : '#555');
      })
      .style('cursor', 'pointer');

    // Zoom behavior - recreate each time to reference current g element
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .filter((event) => {
        // Allow zoom on wheel/pinch
        // Prevent zoom on drag if target is a node (has class 'node' in parent)
        if (event.type === 'mousedown' || event.type === 'touchstart') {
          const target = event.target as Element;
          // Check if click is on a node or its children
          if (target.closest('.node')) {
            return false;  // Let node drag handle it
          }
        }
        return true;  // Allow zoom/pan
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    // Apply zoom behavior
    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    // Update positions on simulation tick
    simulationRef.current.on('tick', () => {
      edgeElements
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Auto camera following (smooth zoom to active nodes)
    if (graphData.activeNodeIds.size > 0) {
      const activeNodes = graphData.nodes.filter(n => graphData.activeNodeIds.has(n.id));

      // Calculate bounds of active nodes
      const xs = activeNodes.map(n => n.x!).filter(x => x !== undefined);
      const ys = activeNodes.map(n => n.y!).filter(y => y !== undefined);

      if (xs.length > 0 && ys.length > 0) {
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const padding = 100;
        const boundsWidth = maxX - minX + padding * 2;
        const boundsHeight = maxY - minY + padding * 2;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const scale = Math.min(
          width / boundsWidth,
          height / boundsHeight,
          2.0  // Max zoom
        );

        // Smooth transition to active area
        svg
          .transition()
          .duration(800)
          .ease(easeCubicOut)
          .call(
            zoomBehaviorRef.current!.transform as any,
            zoomIdentity
              .translate(width / 2, height / 2)
              .scale(scale)
              .translate(-centerX, -centerY)
          );
      }
    }

    return () => {
      // Cleanup simulation on unmount
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [graphData]);

  return (
    <div className="space-y-4">
      {/* Timeline Animation Controls */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750 rounded-lg border-2 border-blue-300 dark:border-blue-700 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Cascade Evolution Timeline
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Loop {currentLoop} of {maxLoop} • {reactions.length} total reactions
            </p>
          </div>
        </div>

        {/* Media Controls */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleStepBackward}
            disabled={currentLoop === 0}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Step backward"
          >
            <SkipBack className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>

          <button
            onClick={handleStop}
            disabled={currentLoop === 0 && !isPlaying}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Stop (reset to beginning)"
          >
            <StopCircle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>

          {isPlaying ? (
            <button
              onClick={handlePause}
              className="p-2 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              title="Pause"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              disabled={currentLoop >= maxLoop && maxLoop > 0}
              className="p-2 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Play"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleStepForward}
            disabled={currentLoop >= maxLoop}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

          {/* Restart Button */}
          <button
            onClick={handleRestart}
            className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
            title="Restart animation from beginning"
          >
            <Play className="w-4 h-4" />
            Restart
          </button>
        </div>

        {/* Loop Scrubber */}
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

      {/* Network Graph Container */}
      <div
        ref={containerRef}
        style={{ width, height }}
        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 relative overflow-hidden"
      >
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
          <button
            onClick={handleZoomReset}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Reset zoom"
          >
            <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <svg
          ref={svgRef}
          className="w-full h-full"
        >
          {/* SVG Filter Definitions */}
          <defs>
            {/* Active node glow filter */}
            <filter id="active-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feFlood floodColor="#FFD700" floodOpacity="0.8" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Subtle glow for recent nodes */}
            <filter id="recent-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feFlood floodColor="#4A90E2" floodOpacity="0.5" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Arrow markers for edges */}
            <marker
              id="arrowhead"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-gray-500 dark:fill-gray-400" />
            </marker>
            <marker
              id="arrowhead-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-blue-500 dark:fill-blue-400" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Advanced Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 rounded px-2 py-1"
        >
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Advanced Settings</h3>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFilters && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <label className="text-sm text-gray-600 dark:text-gray-400">
              Max Pathways: {maxPathways}
            </label>
            <input
              type="range"
              min="10"
              max="200"
              value={maxPathways}
              onChange={(e) => setMaxPathways(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
