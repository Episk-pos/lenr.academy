import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

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
 * Get element symbol from nuclide ID (e.g., "H-1" -> "H")
 */
function getElementSymbol(nuclideId: string): string {
  return nuclideId.split('-')[0];
}

/**
 * Get color for element based on periodic table groups
 * Uses a simple heuristic based on element symbol
 */
function getElementColor(element: string): string {
  // Hydrogen isotopes
  if (['H', 'D', 'T'].includes(element)) return '#FF6B6B';

  // Noble gases
  if (['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn'].includes(element)) return '#95E1D3';

  // Alkali metals
  if (['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'].includes(element)) return '#F38181';

  // Alkaline earth metals
  if (['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'].includes(element)) return '#EAFFD0';

  // Halogens
  if (['F', 'Cl', 'Br', 'I', 'At'].includes(element)) return '#FEC8D8';

  // Common light elements
  if (['C', 'N', 'O'].includes(element)) return '#A8E6CF';

  // Transition metals
  if (['Fe', 'Cu', 'Zn', 'Ag', 'Au', 'Pt'].includes(element)) return '#FFD3B6';

  // Default color for other elements
  return '#DCEDC1';
}

/**
 * Use dagre to calculate hierarchical layout positions
 * Creates a left-to-right flow showing cascade progression
 */
function getLayoutedElements(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure graph for left-to-right hierarchical layout
  dagreGraph.setGraph({
    rankdir: 'LR', // Left to Right
    nodesep: 80,   // Horizontal spacing between nodes
    ranksep: 150,  // Vertical spacing between ranks/levels
  });

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.style?.width || 60,
      height: node.style?.height || 60,
    });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions back to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.style?.width as number || 60) / 2,
        y: nodeWithPosition.y - (node.style?.height as number || 60) / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Build nodes and edges from cascade reactions
 */
function buildGraphElements(reactions: Reaction[]): { nodes: Node[]; edges: Edge[] } {
  const nuclideFrequency = new Map<string, number>();
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Count nuclide frequency
  reactions.forEach((reaction) => {
    [...reaction.inputs, ...reaction.outputs].forEach((nuclide) => {
      nuclideFrequency.set(nuclide, (nuclideFrequency.get(nuclide) || 0) + 1);
    });
  });

  // Create nodes for all unique nuclides (positions will be calculated by dagre)
  nuclideFrequency.forEach((frequency, nuclideId) => {
    const element = getElementSymbol(nuclideId);
    const color = getElementColor(element);

    // Size based on frequency (logarithmic scale for better visual distribution)
    const baseSize = 40;
    const size = baseSize + Math.log(frequency + 1) * 15;

    nodes.push({
      id: nuclideId,
      type: 'default',
      position: { x: 0, y: 0 }, // Temporary position, will be set by dagre
      data: {
        label: nuclideId,
      },
      style: {
        background: color,
        color: '#333',
        border: '2px solid #555',
        borderRadius: '50%',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
      },
    });
  });

  // De-duplicate reactions and aggregate counts
  // Map: unique pathway -> { count, type, avgMeV, loops }
  const pathwayMap = new Map<string, { count: number; type: string; avgMeV: number; loops: Set<number> }>();

  reactions.forEach((reaction) => {
    // Create unique key for this reaction pathway
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

  // Create edges from de-duplicated pathways
  pathwayMap.forEach((pathway, key) => {
    const [inputs, outputs] = key.split('→');
    const inputList = inputs.split('+');
    const outputList = outputs.split('+');

    const reactionType = pathway.type === 'fusion' ? 'F' : '2→2';
    const edgeLabel = `${reactionType} ×${pathway.count} (${pathway.avgMeV.toFixed(1)} MeV)`;
    const edgeColor = pathway.type === 'fusion' ? '#4A90E2' : '#E27D4A';

    // Edge thickness based on count (logarithmic scale)
    const strokeWidth = Math.min(10, 2 + Math.log(pathway.count + 1) * 2);

    if (pathway.type === 'fusion') {
      // Fusion: A + B → C
      // Main edge from first input to output
      edges.push({
        id: `pathway-${key}-main`,
        source: inputList[0],
        target: outputList[0],
        label: edgeLabel,
        type: 'smoothstep',
        animated: pathway.count > 5,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
        style: {
          stroke: edgeColor,
          strokeWidth,
        },
        labelStyle: {
          fontSize: '10px',
          fill: '#666',
        },
      });

      // If there's a second input, show it too (dashed)
      if (inputList[1] && inputList[1] !== inputList[0]) {
        edges.push({
          id: `pathway-${key}-secondary`,
          source: inputList[1],
          target: outputList[0],
          type: 'smoothstep',
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
          style: {
            stroke: edgeColor,
            strokeWidth: Math.max(1, strokeWidth - 1),
            strokeDasharray: '5,5',
          },
        });
      }
    } else {
      // Two-to-two: A + B → C + D
      // Edge to first output
      edges.push({
        id: `pathway-${key}-out1`,
        source: inputList[0],
        target: outputList[0],
        label: edgeLabel,
        type: 'smoothstep',
        animated: pathway.count > 5,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
        style: {
          stroke: edgeColor,
          strokeWidth,
        },
        labelStyle: {
          fontSize: '10px',
          fill: '#666',
        },
      });

      // Edge to second output (if exists)
      if (outputList[1]) {
        edges.push({
          id: `pathway-${key}-out2`,
          source: inputList[0],
          target: outputList[1],
          type: 'smoothstep',
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
          },
          style: {
            stroke: edgeColor,
            strokeWidth: Math.max(1, strokeWidth - 1),
            strokeDasharray: '5,5',
          },
        });
      }
    }
  });

  // Apply dagre hierarchical layout
  return getLayoutedElements(nodes, edges);
}

/**
 * Cascade Network Diagram
 *
 * Visualizes cascade simulation as an interactive network graph:
 * - Nodes: Nuclides (color-coded by element, sized by frequency)
 * - Edges: Reactions (labeled with type and energy)
 */
export default function CascadeNetworkDiagram({
  reactions,
  width = '100%',
  height = '600px',
}: CascadeNetworkDiagramProps) {
  // Build graph elements from reactions
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraphElements(reactions),
    [reactions]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when reactions change (for real-time updates)
  useMemo(() => {
    const { nodes: newNodes, edges: newEdges } = buildGraphElements(reactions);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [reactions, setNodes, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.id);
    // TODO: Show nuclide details in modal
  }, []);

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    console.log('Edge clicked:', edge.id);
    // TODO: Show reaction details in modal
  }, []);

  return (
    <div style={{ width, height }} className="rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
