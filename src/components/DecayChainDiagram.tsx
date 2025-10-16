/**
 * Decay Chain Diagram Component
 *
 * Interactive SVG tree visualization of radioactive decay chains.
 * Shows multi-generation decay sequences with branching paths, decay modes,
 * and half-lives. Nodes are clickable to navigate to nuclide details.
 */

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { DecayChainNode } from '../types'
import { expandHalfLifeUnit } from '../utils/formatUtils'

interface DecayChainDiagramProps {
  root: DecayChainNode
  maxWidth?: number
  maxHeight?: number
  showWrapper?: boolean
  minimal?: boolean  // Minimal styling for embedded use (no borders, simpler controls bar)
}

interface LayoutNode {
  node: DecayChainNode
  x: number
  y: number
  width: number
  height: number
}

interface LayoutEdge {
  from: LayoutNode
  to: LayoutNode
  decayMode: string
  branchingRatio: number
}

/**
 * Get color for decay mode
 */
function getDecayModeColor(decayMode: string): string {
  const mode = decayMode.toUpperCase()
  if (mode.includes('A')) return '#dc2626' // red-600
  if (mode.includes('B-') || mode.includes('β-')) return '#2563eb' // blue-600
  if (mode.includes('B+') || mode.includes('β+')) return '#16a34a' // green-600
  if (mode.includes('EC')) return '#9333ea' // purple-600
  if (mode.includes('IT')) return '#ca8a04' // yellow-600
  return '#6b7280' // gray-500
}

/**
 * Get background color for stable/radioactive nodes
 */
function getNodeBackground(isStable: boolean, isDark: boolean): string {
  if (isStable) {
    return isDark ? '#166534' : '#dcfce7' // green-800 / green-100
  }
  return isDark ? '#7c2d12' : '#fed7aa' // orange-900 / orange-200
}

/**
 * Get border color for stable/radioactive nodes
 */
function getNodeBorder(isStable: boolean, isDark: boolean): string {
  if (isStable) {
    return isDark ? '#22c55e' : '#16a34a' // green-500 / green-600
  }
  return isDark ? '#f97316' : '#ea580c' // orange-500 / orange-600
}

/**
 * Format half-life for display
 */
function formatHalfLife(node: DecayChainNode): string {
  if (node.halfLife !== undefined && node.halfLifeUnits) {
    const hl = node.halfLife
    const units = expandHalfLifeUnit(node.halfLifeUnits)
    if (hl >= 10000) {
      return `${hl.toExponential(1)} ${units}`
    }
    return `${hl} ${units}`
  }
  if (node.logHalfLife !== undefined) {
    const hl = Math.pow(10, node.logHalfLife)
    return `${hl.toExponential(1)} y`
  }
  return node.isStable ? 'Stable' : '—'
}

/**
 * Layout algorithm: Horizontal tree layout (left to right) with vertical spacing for siblings
 */
function layoutTree(root: DecayChainNode): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodeWidth = 120
  const nodeHeight = 60
  const horizontalSpacing = 140  // Space between generations (left to right)
  const verticalSpacing = 20     // Space between siblings (up and down)

  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []

  // Calculate subtree height for each node
  function calculateHeight(node: DecayChainNode): number {
    if (node.children.length === 0) {
      return nodeHeight
    }
    const childHeights = node.children.map(calculateHeight)
    const totalChildHeight = childHeights.reduce((sum, h) => sum + h, 0)
    const spacing = (node.children.length - 1) * verticalSpacing
    return Math.max(nodeHeight, totalChildHeight + spacing)
  }

  // Position nodes recursively (horizontal layout)
  function positionNode(
    node: DecayChainNode,
    x: number,
    y: number,
    subtreeHeight: number,
    parent?: LayoutNode
  ): LayoutNode {
    // Create layout node - center vertically within subtree
    const layoutNode: LayoutNode = {
      node,
      x,
      y: y + subtreeHeight / 2 - nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight
    }
    nodes.push(layoutNode)

    // Create edge to parent
    if (parent && node.decayMode) {
      edges.push({
        from: parent,
        to: layoutNode,
        decayMode: node.decayMode,
        branchingRatio: node.branchingRatio ?? 100
      })
    }

    // Position children (move right, stack vertically)
    if (node.children.length > 0) {
      let childY = y
      node.children.forEach(child => {
        const childHeight = calculateHeight(child)
        positionNode(
          child,
          x + nodeWidth + horizontalSpacing,
          childY,
          childHeight,
          layoutNode
        )
        childY += childHeight + verticalSpacing
      })
    }

    return layoutNode
  }

  const totalHeight = calculateHeight(root)
  positionNode(root, 0, 0, totalHeight)

  return { nodes, edges }
}

export default function DecayChainDiagram({ root, maxHeight = 600, showWrapper = true, minimal = false }: DecayChainDiagramProps) {
  const navigate = useNavigate()
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [isDark] = useState(() => document.documentElement.classList.contains('dark'))

  // Layout the tree
  const { nodes, edges } = useMemo(() => layoutTree(root), [root])

  // Calculate SVG viewBox
  const bounds = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, width: 400, height: 300 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    nodes.forEach(n => {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.width)
      maxY = Math.max(maxY, n.y + n.height)
    })

    const padding = 20
    return {
      minX: minX - padding,
      minY: minY - padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding
    }
  }, [nodes])

  // Handle node click
  const handleNodeClick = (node: DecayChainNode) => {
    navigate(`/element-data?Z=${node.nuclide.Z}&A=${node.nuclide.A}`)
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        No decay chain data available
      </div>
    )
  }

  const content = (
    <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={4}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ disabled: false, mode: 'zoomIn' }}
        panning={{ velocityDisabled: false }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Zoom Controls */}
            <div className={minimal
              ? "flex items-center gap-2 p-2"
              : "flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
            }>
              <button
                onClick={() => zoomIn()}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
              <button
                onClick={() => zoomOut()}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
              <button
                onClick={() => resetTransform()}
                className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Reset view"
              >
                <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                Scroll to zoom • Drag to pan • Double-click to zoom in
              </span>
            </div>

            {/* SVG Canvas */}
            <TransformComponent
              wrapperStyle={{
                width: '100%',
                height: maxHeight ? `${maxHeight}px` : '600px',
                cursor: 'grab'
              }}
              contentStyle={{
                width: '100%',
                height: '100%'
              }}
            >
              <svg
                viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
              >
        {/* Define arrow marker for edges */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3, 0 6"
              fill={isDark ? '#9ca3af' : '#4b5563'}
            />
          </marker>
        </defs>

        {/* Draw edges first (behind nodes) */}
        {edges.map((edge, idx) => {
          const fromX = edge.from.x + edge.from.width
          const fromY = edge.from.y + edge.from.height / 2
          const toX = edge.to.x
          const toY = edge.to.y + edge.to.height / 2

          const midX = (fromX + toX) / 2
          const color = getDecayModeColor(edge.decayMode)

          return (
            <g key={idx}>
              {/* Edge line - horizontal with vertical connection */}
              <path
                d={`M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`}
                stroke={color}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
              {/* Decay mode label */}
              <text
                x={midX}
                y={Math.min(fromY, toY) + Math.abs(toY - fromY) / 2 - 5}
                textAnchor="middle"
                fontSize="10"
                fill={isDark ? '#d1d5db' : '#374151'}
                fontWeight="600"
              >
                {edge.decayMode}
                {edge.branchingRatio < 99 && ` (${edge.branchingRatio.toFixed(0)}%)`}
              </text>
            </g>
          )
        })}

        {/* Draw nodes */}
        {nodes.map((layoutNode, idx) => {
          const node = layoutNode.node
          const nodeKey = `${node.nuclide.Z}-${node.nuclide.A}`
          const isHovered = hoveredNode === nodeKey

          return (
            <g
              key={idx}
              transform={`translate(${layoutNode.x}, ${layoutNode.y})`}
              onMouseEnter={() => setHoveredNode(nodeKey)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(node)}
              className="cursor-pointer"
              style={{ transition: 'transform 0.2s' }}
            >
              {/* Node rectangle */}
              <rect
                width={layoutNode.width}
                height={layoutNode.height}
                rx="8"
                fill={getNodeBackground(node.isStable, isDark)}
                stroke={getNodeBorder(node.isStable, isDark)}
                strokeWidth={isHovered ? '3' : '2'}
                style={{ transition: 'stroke-width 0.2s' }}
              />

              {/* Element symbol and mass number */}
              <text
                x={layoutNode.width / 2}
                y={20}
                textAnchor="middle"
                fontSize="16"
                fontWeight="700"
                fill={isDark ? '#f9fafb' : '#111827'}
              >
                {node.nuclide.E}-{node.nuclide.A}
              </text>

              {/* Half-life */}
              <text
                x={layoutNode.width / 2}
                y={38}
                textAnchor="middle"
                fontSize="10"
                fill={isDark ? '#d1d5db' : '#6b7280'}
              >
                {formatHalfLife(node)}
              </text>

              {/* Stability indicator */}
              <text
                x={layoutNode.width / 2}
                y={52}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill={node.isStable ? (isDark ? '#86efac' : '#16a34a') : (isDark ? '#fdba74' : '#ea580c')}
              >
                {node.isStable ? 'STABLE' : 'RADIOACTIVE'}
              </text>

              {/* Hover tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={-10}
                    y={layoutNode.height + 5}
                    width={layoutNode.width + 20}
                    height="30"
                    rx="4"
                    fill={isDark ? '#1f2937' : '#ffffff'}
                    stroke={isDark ? '#4b5563' : '#d1d5db'}
                    strokeWidth="1"
                  />
                  <text
                    x={layoutNode.width / 2}
                    y={layoutNode.height + 22}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isDark ? '#f3f4f6' : '#111827'}
                  >
                    Click to view details
                  </text>
                </g>
              )}
            </g>
          )
        })}
              </svg>
            </TransformComponent>

            {/* Legend - outside the zoomable area */}
            <div className={minimal
              ? "p-3"
              : "p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
            }>
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Decay Modes</h4>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#dc2626' }} />
                  <span className="text-gray-600 dark:text-gray-400">Alpha (α)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#2563eb' }} />
                  <span className="text-gray-600 dark:text-gray-400">Beta- (β-)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#16a34a' }} />
                  <span className="text-gray-600 dark:text-gray-400">Beta+ (β+)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#9333ea' }} />
                  <span className="text-gray-600 dark:text-gray-400">EC</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-8 h-0.5" style={{ backgroundColor: '#ca8a04' }} />
                  <span className="text-gray-600 dark:text-gray-400">IT</span>
                </div>
              </div>
            </div>
          </>
        )}
      </TransformWrapper>
  )

  return showWrapper ? (
    <div className="w-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {content}
    </div>
  ) : content
}
