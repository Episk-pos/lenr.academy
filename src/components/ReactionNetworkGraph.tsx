import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import * as d3 from 'd3-selection'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type ForceLink,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import { zoom, zoomIdentity } from 'd3-zoom'
import { drag } from 'd3-drag'
import { ChevronDown } from 'lucide-react'
import type { FusionReaction, FissionReaction, TwoToTwoReaction } from '../types'

// ─── Types ──────────────────────────────────────────────────────────────────

type ReactionType = 'fusion' | 'fission' | 'twotwo'

interface ReactionNetworkGraphProps {
  reactions: FusionReaction[] | FissionReaction[] | TwoToTwoReaction[]
  reactionType: ReactionType
}

interface GraphNode extends SimulationNodeDatum {
  id: string
  label: string
  Z: number
  reactionCount: number
  size: number
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  MeV: number
  equation: string
  weight: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_REACTIONS_DEFAULT = 200
const SVG_WIDTH = 800
const SVG_HEIGHT = 600

// ─── Graph Builder ──────────────────────────────────────────────────────────

function buildGraph(
  reactions: FusionReaction[] | FissionReaction[] | TwoToTwoReaction[],
  reactionType: ReactionType
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodeMap = new Map<string, { Z: number; count: number }>()
  const links: GraphLink[] = []

  function addNode(symbol: string, Z: number) {
    const existing = nodeMap.get(symbol)
    if (existing) {
      existing.count++
    } else {
      nodeMap.set(symbol, { Z, count: 1 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of reactions as any[]) {
    if (reactionType === 'fusion') {
      // A + B → C
      addNode(r.E1, r.Z1)
      addNode(r.E2, r.Z2)
      addNode(r.E, r.Z)
      const eq = `${r.E1}-${r.A1} + ${r.E2}-${r.A2} → ${r.E}-${r.A}`
      links.push({ source: r.E1, target: r.E, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
      links.push({ source: r.E2, target: r.E, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
    } else if (reactionType === 'fission') {
      // A → B + C
      addNode(r.E, r.Z)
      addNode(r.E1, r.Z1)
      addNode(r.E2, r.Z2)
      const eq = `${r.E}-${r.A} → ${r.E1}-${r.A1} + ${r.E2}-${r.A2}`
      links.push({ source: r.E, target: r.E1, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
      links.push({ source: r.E, target: r.E2, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
    } else {
      // A + B → C + D
      addNode(r.E1, r.Z1)
      addNode(r.E2, r.Z2)
      addNode(r.E3, r.Z3)
      addNode(r.E4, r.Z4)
      const eq = `${r.E1}-${r.A1} + ${r.E2}-${r.A2} → ${r.E3}-${r.A3} + ${r.E4}-${r.A4}`
      links.push({ source: r.E1, target: r.E3, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
      links.push({ source: r.E1, target: r.E4, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
      links.push({ source: r.E2, target: r.E3, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
      links.push({ source: r.E2, target: r.E4, MeV: r.MeV, equation: eq, weight: Math.abs(r.MeV) })
    }
  }

  // Deduplicate links: merge parallel edges between same source-target
  const linkKey = (s: string, t: string) => s < t ? `${s}→${t}` : `${t}→${s}`
  const deduped = new Map<string, GraphLink>()
  for (const link of links) {
    const s = typeof link.source === 'string' ? link.source : link.source.id
    const t = typeof link.target === 'string' ? link.target : link.target.id
    if (s === t) continue // skip self-links
    const key = linkKey(s, t)
    const existing = deduped.get(key)
    if (existing) {
      existing.weight += link.weight
    } else {
      deduped.set(key, { ...link })
    }
  }

  const maxCount = Math.max(...Array.from(nodeMap.values()).map(v => v.count), 1)
  const nodes: GraphNode[] = Array.from(nodeMap.entries()).map(([id, data]) => ({
    id,
    label: id,
    Z: data.Z,
    reactionCount: data.count,
    size: 8 + (data.count / maxCount) * 20,
  }))

  return { nodes, links: Array.from(deduped.values()) }
}

// ─── HSL color from Z ───────────────────────────────────────────────────────

function zToColor(Z: number): string {
  const hue = (Z * 137.508) % 360 // golden angle for good distribution
  return `hsl(${hue}, 70%, 55%)`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReactionNetworkGraph({ reactions, reactionType }: ReactionNetworkGraphProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const prevNodeIdsRef = useRef<string>('')
  const [expanded, setExpanded] = useState(false)
  const [limitResults, setLimitResults] = useState(true)

  // Trim to top N reactions by |MeV| if needed
  const displayReactions = useMemo(() => {
    if (reactions.length <= MAX_REACTIONS_DEFAULT || !limitResults) {
      return reactions
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sorted = [...reactions].sort((a: any, b: any) => Math.abs(b.MeV) - Math.abs(a.MeV))
    return sorted.slice(0, MAX_REACTIONS_DEFAULT)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [reactions, limitResults]) as any[]

  const isTruncated = reactions.length > MAX_REACTIONS_DEFAULT && limitResults

  const graphData = useMemo(
    () => buildGraph(displayReactions, reactionType),
    [displayReactions, reactionType]
  )

  // D3 rendering
  const renderGraph = useCallback(() => {
    if (!svgRef.current || graphData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    const width = SVG_WIDTH
    const height = SVG_HEIGHT
    const textColor = isDark ? '#d1d5db' : '#374151'
    const bgColor = isDark ? '#1f2937' : '#ffffff'

    // Check if the node set changed
    const currentNodeIds = graphData.nodes.map(n => n.id).sort().join(',')
    const nodesChanged = currentNodeIds !== prevNodeIdsRef.current
    prevNodeIdsRef.current = currentNodeIds

    // Deep clone nodes/links for simulation
    const simNodes: GraphNode[] = graphData.nodes.map(n => ({ ...n }))
    const simLinks: GraphLink[] = graphData.links.map(l => ({
      ...l,
      source: typeof l.source === 'string' ? l.source : l.source.id,
      target: typeof l.target === 'string' ? l.target : l.target.id,
    }))

    // Find max weight for link scaling
    const maxWeight = Math.max(...simLinks.map(l => l.weight), 1)

    let simulation: Simulation<GraphNode, GraphLink>

    if (simulationRef.current && !nodesChanged) {
      // Node set hasn't changed — skip full rebuild, just update visuals for theme changes
      simulation = simulationRef.current
    } else if (simulationRef.current && nodesChanged) {
      // Node set changed — preserve positions of existing nodes, initialize new ones at center
      const oldSim = simulationRef.current
      const oldNodes: GraphNode[] = oldSim.nodes()
      const positionMap = new Map(oldNodes.map(n => [n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }]))

      simNodes.forEach(node => {
        const oldPos = positionMap.get(node.id)
        if (oldPos) {
          node.x = oldPos.x
          node.y = oldPos.y
          node.vx = oldPos.vx
          node.vy = oldPos.vy
        } else {
          node.x = width / 2 + (Math.random() - 0.5) * 200
          node.y = height / 2 + (Math.random() - 0.5) * 200
          node.vx = 0
          node.vy = 0
        }
      })

      oldSim.stop()

      const chargeStrength = simNodes.length > 30 ? -300 : simNodes.length > 15 ? -200 : -150
      simulation = forceSimulation(simNodes)
        .force('link', forceLink<GraphNode, GraphLink>(simLinks)
          .id(d => d.id)
          .distance(80)
          .strength(0.4)
        )
        .force('charge', forceManyBody().strength(chargeStrength))
        .force('center', forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', forceCollide<GraphNode>().radius(d => d.size + 5))
        .alphaDecay(0.02)
        .velocityDecay(0.5)

      // Gentle restart instead of full alpha=1
      simulation.alpha(0.3).restart()
      simulationRef.current = simulation
    } else {
      // First render — initialize all nodes at center with random offset
      simNodes.forEach(node => {
        node.x = width / 2 + (Math.random() - 0.5) * 200
        node.y = height / 2 + (Math.random() - 0.5) * 200
        node.vx = 0
        node.vy = 0
      })

      const chargeStrength = simNodes.length > 30 ? -300 : simNodes.length > 15 ? -200 : -150
      simulation = forceSimulation(simNodes)
        .force('link', forceLink<GraphNode, GraphLink>(simLinks)
          .id(d => d.id)
          .distance(80)
          .strength(0.4)
        )
        .force('charge', forceManyBody().strength(chargeStrength))
        .force('center', forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', forceCollide<GraphNode>().radius(d => d.size + 5))
        .alphaDecay(0.02)
        .velocityDecay(0.5)

      simulationRef.current = simulation
    }

    // Rebuild SVG elements (needed for theme changes and data updates)
    svg.selectAll('*').remove()

    // Background
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', bgColor)
      .attr('rx', 8)

    const container = svg.append('g').attr('class', 'graph-container')

    // Edges
    const linkGroup = container.append('g').attr('class', 'edges')
    const linkElements = linkGroup.selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', d => d.MeV >= 0 ? (isDark ? '#34d399' : '#059669') : (isDark ? '#f87171' : '#dc2626'))
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => 1 + (d.weight / maxWeight) * 3)

    // Nodes
    const nodeGroup = container.append('g').attr('class', 'nodes')
    const nodeElements = nodeGroup.selectAll<SVGGElement, GraphNode>('g')
      .data(simulation.nodes())
      .join('g')
      .attr('cursor', 'grab')

    // Node circles
    nodeElements.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => zToColor(d.Z))
      .attr('stroke', isDark ? '#374151' : '#e5e7eb')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.85)

    // Node labels
    nodeElements.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => d.size > 15 ? 11 : 9)
      .attr('font-weight', '600')
      .attr('fill', textColor)
      .attr('pointer-events', 'none')

    // Tooltip group
    const tooltip = svg.append('g')
      .attr('class', 'tooltip')
      .attr('visibility', 'hidden')

    const tooltipRect = tooltip.append('rect')
      .attr('rx', 4)
      .attr('fill', isDark ? '#374151' : '#ffffff')
      .attr('stroke', isDark ? '#6b7280' : '#d1d5db')
      .attr('stroke-width', 1)

    const tooltipText = tooltip.append('text')
      .attr('font-size', 11)
      .attr('fill', textColor)

    // Node hover
    nodeElements
      .on('mouseover', function (_event, d) {
        d3.select(this).select('circle')
          .attr('stroke-width', 3)
          .attr('stroke', isDark ? '#f3f4f6' : '#1f2937')

        // Highlight connected edges
        linkElements
          .attr('stroke-opacity', l => {
            const sourceId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source
            const targetId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target
            return sourceId === d.id || targetId === d.id ? 0.9 : 0.1
          })

        // Show tooltip
        const text = t('networkGraph.nodeTooltipFull', { element: d.label, Z: d.Z, count: d.reactionCount })
        tooltipText.text(text)
        const textBBox = (tooltipText.node() as SVGTextElement).getBBox()
        tooltipRect
          .attr('x', -4)
          .attr('y', textBBox.y - 4)
          .attr('width', textBBox.width + 8)
          .attr('height', textBBox.height + 8)

        const tx = Math.min((d.x || 0) + d.size + 10, width - textBBox.width - 20)
        const ty = Math.max((d.y || 0) - 10, 20)
        tooltip
          .attr('transform', `translate(${tx}, ${ty})`)
          .attr('visibility', 'visible')
      })
      .on('mouseout', function () {
        d3.select(this).select('circle')
          .attr('stroke-width', 1.5)
          .attr('stroke', isDark ? '#374151' : '#e5e7eb')

        linkElements.attr('stroke-opacity', 0.4)
        tooltip.attr('visibility', 'hidden')
      })

    // Edge hover
    linkElements
      .on('mouseover', function (_event, d) {
        d3.select(this)
          .attr('stroke-opacity', 0.9)
          .attr('stroke-width', 4)

        const text = `${d.equation}  (${d.MeV >= 0 ? '+' : ''}${d.MeV.toFixed(3)} MeV)`
        tooltipText.text(text)
        const textBBox = (tooltipText.node() as SVGTextElement).getBBox()
        tooltipRect
          .attr('x', -4)
          .attr('y', textBBox.y - 4)
          .attr('width', textBBox.width + 8)
          .attr('height', textBBox.height + 8)

        const sx = typeof d.source === 'object' ? (d.source as GraphNode).x || 0 : 0
        const sy = typeof d.source === 'object' ? (d.source as GraphNode).y || 0 : 0
        const tx = typeof d.target === 'object' ? (d.target as GraphNode).x || 0 : 0
        const ty = typeof d.target === 'object' ? (d.target as GraphNode).y || 0 : 0
        const mx = (sx + tx) / 2
        const my = (sy + ty) / 2

        tooltip
          .attr('transform', `translate(${Math.min(mx, width - textBBox.width - 20)}, ${Math.max(my - 20, 20)})`)
          .attr('visibility', 'visible')
      })
      .on('mouseout', function (_event, d) {
        d3.select(this)
          .attr('stroke-opacity', 0.4)
          .attr('stroke-width', 1 + (d.weight / maxWeight) * 3)
        tooltip.attr('visibility', 'hidden')
      })

    // Drag behavior
    const dragBehavior = drag<SVGGElement, GraphNode>()
      .on('start', function (_event, d) {
        simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
        d3.select(this).attr('cursor', 'grabbing')
      })
      .on('drag', function (event, d) {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', function (_event, d) {
        simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
        d3.select(this).attr('cursor', 'grab')
      })

    nodeElements.call(dragBehavior)

    // Zoom behavior
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoomBehavior)
    svg.call(zoomBehavior.transform, zoomIdentity)

    // Re-bind the tick handler to update the new SVG elements
    // Use the simulation's actual nodes (which have live x/y positions)
    const simNodesLive = simulation.nodes()
    // Re-bind link data to match simulation's link objects
    const simForceLink = simulation.force('link') as ForceLink<GraphNode, GraphLink> | undefined
    const simLinksLive = simForceLink ? simForceLink.links() : simLinks

    // Update link data binding to use live simulation links
    linkElements.data(simLinksLive)
    nodeElements.data(simNodesLive)

    simulation.on('tick', () => {
      linkElements
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0)

      nodeElements
        .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
    })
  }, [graphData, isDark, t])

  useEffect(() => {
    if (expanded) {
      renderGraph()
    }
    return () => {
      if (!expanded) {
        simulationRef.current?.stop()
        simulationRef.current = null
        prevNodeIdsRef.current = ''
      }
    }
  }, [expanded, renderGraph])

  if (reactions.length === 0) return null

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('networkGraph.reactionNetwork')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('networkGraph.reactionNetworkDesc')}
            {graphData.nodes.length > 0 && ` — ${t('networkGraph.graphStats', { nodes: graphData.nodes.length, links: graphData.links.length })}`}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn btn-secondary p-2 ml-4"
        >
          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="pt-4">
          {isTruncated && (
            <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
              <span>{t('networkGraph.tooManyReactions', { count: MAX_REACTIONS_DEFAULT })}</span>
              <button
                onClick={() => setLimitResults(false)}
                className="ml-3 underline hover:no-underline text-xs"
              >
                {t('networkGraph.showAll')}
              </button>
            </div>
          )}
          <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <svg
              ref={svgRef}
              width="100%"
              height={SVG_HEIGHT}
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
            />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: isDark ? '#34d399' : '#059669' }} />
              {t('networkGraph.exothermic')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: isDark ? '#f87171' : '#dc2626' }} />
              {t('networkGraph.endothermic')}
            </span>
            <span className="ml-auto">{t('networkGraph.instructions')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
