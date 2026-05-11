import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Play,
  Zap,
  RefreshCw,
  RotateCcw,
  Gem,
  Shield,
  ArrowRight,
  GitMerge,
  ArrowLeftRight,
  Scissors,
} from 'lucide-react'
import type { DiscoveredCycle, CycleReaction } from '../types'

interface CycleVisualizationProps {
  cycle: DiscoveredCycle
  onRunSimulation: (cycle: DiscoveredCycle) => void
  onBack: () => void
}

// ---------------------------------------------------------------------------
// Nuclide flow analysis
// ---------------------------------------------------------------------------

type NuclideKey = string // "E-A" format

function nKey(n: { E: string; A: number }): NuclideKey {
  return `${n.E}-${n.A}`
}

/**
 * Build a NuclideKey -> {E,Z,A} lookup from all inputs and outputs across the
 * cycle's reactions, so callers can resolve a key (e.g., from feedbackNuclides
 * or byproducts) back to the full nuclide object for rendering.
 */
function buildNuclideMap(
  reactions: CycleReaction[]
): Map<NuclideKey, { E: string; Z: number; A: number }> {
  const map = new Map<NuclideKey, { E: string; Z: number; A: number }>()
  for (const r of reactions) {
    for (const ref of [...r.inputs, ...r.outputs]) {
      const k = nKey(ref)
      if (!map.has(k)) map.set(k, ref)
    }
  }
  return map
}

interface FlowEdge {
  nuclideKey: NuclideKey
  fromStep: number // reaction index that produced it
  toStep: number   // reaction index that consumes it
}

/**
 * Analyze how nuclides flow between reaction steps.
 * For each reaction's inputs, check if that nuclide was an output of a previous step.
 */
function analyzeFlow(
  reactions: CycleReaction[],
  fuelKeys: Set<NuclideKey>
): { flows: FlowEdge[]; byproducts: Map<number, NuclideKey[]>; feedbackNuclides: Set<NuclideKey> } {
  const flows: FlowEdge[] = []
  // Track which nuclides are produced at each step
  const producedAt = new Map<NuclideKey, number>()
  // Track which nuclides are consumed (used as input to a later step)
  const consumed = new Set<NuclideKey>()
  // Nuclides that are regenerated (feedback)
  const feedbackNuclides = new Set<NuclideKey>()

  // First pass: record all outputs with their step index
  for (let i = 0; i < reactions.length; i++) {
    for (const out of reactions[i].outputs) {
      const key = nKey(out)
      // Don't overwrite — keep the first producer
      if (!producedAt.has(key)) {
        producedAt.set(key, i)
      }
    }
  }

  // Second pass: for each input, find which previous step produced it
  for (let i = 0; i < reactions.length; i++) {
    for (const inp of reactions[i].inputs) {
      const key = nKey(inp)
      if (fuelKeys.has(key)) continue // Fuel is always available, not a "flow"
      const fromStep = producedAt.get(key)
      if (fromStep !== undefined && fromStep < i) {
        flows.push({ nuclideKey: key, fromStep, toStep: i })
        consumed.add(key)
      }
    }

    // Check if this step regenerates a previously-consumed nuclide
    if (reactions[i].isFeedback) {
      for (const out of reactions[i].outputs) {
        const key = nKey(out)
        if (consumed.has(key) || fuelKeys.has(key)) {
          feedbackNuclides.add(key)
        }
      }
    }
  }

  // Byproducts: outputs that are never consumed by a later step
  const byproducts = new Map<number, NuclideKey[]>()
  for (let i = 0; i < reactions.length; i++) {
    const stepByproducts: NuclideKey[] = []
    for (const out of reactions[i].outputs) {
      const key = nKey(out)
      if (!consumed.has(key) && !fuelKeys.has(key) && !feedbackNuclides.has(key)) {
        stepByproducts.push(key)
      }
    }
    if (stepByproducts.length > 0) {
      byproducts.set(i, stepByproducts)
    }
  }

  return { flows, byproducts, feedbackNuclides }
}

// ---------------------------------------------------------------------------
// Consistent nuclide colors for flow visualization
// ---------------------------------------------------------------------------

// Intermediary flow palette. Amber is reserved for FUEL; teal is reserved
// for CATALYST. Neither should appear here, or the role coding collapses.
const FLOW_COLORS = [
  { line: '#0ea5e9', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-400 dark:ring-sky-600' },
  { line: '#8b5cf6', bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-400 dark:ring-violet-600' },
  { line: '#10b981', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-400 dark:ring-emerald-600' },
  { line: '#ef4444', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-400 dark:ring-red-600' },
  { line: '#ec4899', bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', ring: 'ring-pink-400 dark:ring-pink-600' },
]

function getFlowColor(index: number) {
  return FLOW_COLORS[index % FLOW_COLORS.length]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NuclideBadge({
  nuclide,
  variant = 'default',
  isHighlighted,
  isDimmed,
  onHover,
  colorClass,
}: {
  nuclide: { E: string; Z: number; A: number }
  variant?: 'default' | 'fuel' | 'catalyst' | 'feedback' | 'byproduct'
  isHighlighted?: boolean
  isDimmed?: boolean
  onHover?: (key: NuclideKey | null) => void
  colorClass?: string
}) {
  const key = nKey(nuclide)

  const variantClasses = {
    default: 'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200',
    // FUEL: amber. Consumed each cycle iteration, never regenerated.
    fuel: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-700',
    // CATALYST: teal. Consumed at one step, regenerated at a later step. Defines the cycle's identity.
    catalyst: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 ring-2 ring-teal-400 dark:ring-teal-500',
    // Legacy alias — kept to avoid drive-by churn in unrelated call sites. Prefer 'catalyst'.
    feedback: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 ring-2 ring-teal-400 dark:ring-teal-500',
    byproduct: 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-150 cursor-default ${
        colorClass || variantClasses[variant]
      } ${isHighlighted ? 'ring-2 ring-offset-1 ring-primary-500 dark:ring-primary-400 scale-110 z-10' : ''} ${
        isDimmed ? 'opacity-30' : ''
      }`}
      onMouseEnter={() => onHover?.(key)}
      onMouseLeave={() => onHover?.(null)}
    >
      <sup className="text-[10px] mr-0.5">{nuclide.A}</sup>
      {nuclide.E}
    </span>
  )
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
  color: string
}) {
  return (
    <div className={`card p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function ReactionTypeBadge({ type }: { type: CycleReaction['type'] }) {
  const { t } = useTranslation()
  const colors = {
    fusion: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
    twotwo: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
    fission: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
  }
  const icons = {
    fusion: <GitMerge className="w-3 h-3" />,
    twotwo: <ArrowLeftRight className="w-3 h-3" />,
    fission: <Scissors className="w-3 h-3" />,
  }
  const labels = { fusion: t('cycleDiscovery.reactionTypeFusion'), twotwo: t('cycleDiscovery.reactionTypeTwoToTwo'), fission: t('cycleDiscovery.reactionTypeFission') }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[type]}`}>
      {icons[type]}
      {labels[type]}
    </span>
  )
}

// ---------------------------------------------------------------------------
// SVG Cycle Loop Diagram
// ---------------------------------------------------------------------------

/**
 * Closed-loop diagram: catalyst nuclides sit in the center as the "core"
 * being recycled, reaction nodes wrap the perimeter, and a single bold
 * amber arrow flows around the perimeter (last step back to first), making
 * the closure visually unmistakable.
 */
function CycleLoopDiagram({
  cycle,
  flows,
  feedbackNuclides,
  nuclideColorMap,
  byproducts,
  hoveredNuclide,
  catalysts,
}: {
  cycle: DiscoveredCycle
  flows: FlowEdge[]
  feedbackNuclides: Set<NuclideKey>
  nuclideColorMap: Map<NuclideKey, number>
  byproducts: Map<number, NuclideKey[]>
  hoveredNuclide: NuclideKey | null
  catalysts: Array<{ E: string; Z: number; A: number }>
}) {
  const { t } = useTranslation()
  const { reactions } = cycle
  const n = reactions.length

  // Layout
  const cx = 320
  const cy = 280
  const radius = Math.min(200, 110 + n * 22)
  const nodeW = 200
  const nodeH = 56

  // Angle for each reaction node (starting from top, going clockwise)
  const angles = reactions.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2)

  // Node centre positions
  const nodePositions = angles.map((a) => ({
    x: cx + radius * Math.cos(a),
    y: cy + radius * Math.sin(a),
  }))

  const svgW = cx * 2 + 40
  const svgH = cy * 2 + 40

  // Outer perimeter radius (where bold cycle arrows hug the outside of nodes)
  const perimeterRadius = radius + Math.max(nodeH, nodeW * 0.35) * 0.6

  // Build flow arcs (intermediary, demoted to hairlines through the centre)
  const flowArcs = flows.map((f) => {
    const from = nodePositions[f.fromStep]
    const to = nodePositions[f.toStep]
    const colorIdx = nuclideColorMap.get(f.nuclideKey) ?? 0
    const color = getFlowColor(colorIdx)
    return { ...f, from, to, color }
  })

  // Build perimeter arrows: from step i -> step (i+1) % n
  // Each arrow follows an arc that hugs the OUTSIDE of the ring.
  const perimeterArrows = reactions.map((_, i) => {
    const fromAngle = angles[i]
    const toAngle = angles[(i + 1) % n]
    // Start/end points sit on the perimeterRadius circle, slightly offset so
    // the arrow does not visually collide with the rectangle nodes.
    const fromAngleEdge = fromAngle + (Math.PI / n) * 0.45
    const toAngleEdge = toAngle - (Math.PI / n) * 0.45
    const from = {
      x: cx + perimeterRadius * Math.cos(fromAngleEdge),
      y: cy + perimeterRadius * Math.sin(fromAngleEdge),
    }
    const to = {
      x: cx + perimeterRadius * Math.cos(toAngleEdge),
      y: cy + perimeterRadius * Math.sin(toAngleEdge),
    }
    // Use SVG arc command sweeping along the perimeter circle
    return { from, to }
  })

  // Outgoing byproduct rays
  type BPRay = { stepIdx: number; nuclideKey: NuclideKey; from: { x: number; y: number }; to: { x: number; y: number } }
  const byproductRays: BPRay[] = []
  byproducts.forEach((keys, stepIdx) => {
    const a = angles[stepIdx]
    keys.forEach((key, i) => {
      // Stagger multiple byproducts by spreading them along a small arc
      const spread = (i - (keys.length - 1) / 2) * 0.12
      const rayAngle = a + spread
      const rayStartR = radius + nodeH * 0.55
      const rayEndR = perimeterRadius + 32
      byproductRays.push({
        stepIdx,
        nuclideKey: key,
        from: {
          x: cx + rayStartR * Math.cos(rayAngle),
          y: cy + rayStartR * Math.sin(rayAngle),
        },
        to: {
          x: cx + rayEndR * Math.cos(rayAngle),
          y: cy + rayEndR * Math.sin(rayAngle),
        },
      })
    })
  })

  // Resolve byproduct keys back to {E, A} via a quick lookup over outputs
  const nuclideLabelByKey = new Map<NuclideKey, string>()
  for (const r of reactions) {
    for (const out of r.outputs) {
      const k = nKey(out)
      if (!nuclideLabelByKey.has(k)) nuclideLabelByKey.set(k, `${out.A}${out.E}`)
    }
  }

  // Closing edges: for each catalyst, the arc from the regeneration step's
  // output back to the consumption step's input. This is what makes the cycle
  // visually a cycle rather than a tree.
  interface ClosingEdge {
    nuclideKey: NuclideKey
    fromStep: number // regeneration (later)
    toStep: number   // consumption (earlier)
    from: { x: number; y: number }
    to: { x: number; y: number }
    colorIdx: number | undefined
    label: string
  }
  const closingEdges: ClosingEdge[] = []
  for (const key of feedbackNuclides) {
    let consumerStep = -1
    for (let i = 0; i < reactions.length; i++) {
      if (reactions[i].inputs.some((inp) => nKey(inp) === key)) {
        consumerStep = i
        break
      }
    }
    if (consumerStep < 0) continue
    let producerStep = -1
    for (let i = reactions.length - 1; i > consumerStep; i--) {
      if (reactions[i].outputs.some((out) => nKey(out) === key)) {
        producerStep = i
        break
      }
    }
    if (producerStep < 0) continue
    closingEdges.push({
      nuclideKey: key,
      fromStep: producerStep,
      toStep: consumerStep,
      from: nodePositions[producerStep],
      to: nodePositions[consumerStep],
      colorIdx: nuclideColorMap.get(key),
      label: nuclideLabelByKey.get(key) ?? key,
    })
  }

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full max-w-3xl mx-auto"
      style={{ maxHeight: 600 }}
    >
      <defs>
        <marker
          id="arrowPerimeter"
          markerWidth="14"
          markerHeight="10"
          refX="11"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M0,0 L14,5 L0,10 Z"
            className="fill-amber-500 dark:fill-amber-400"
          />
        </marker>
        <marker
          id="arrowByproduct"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path
            d="M0,0 L8,3 L0,6"
            className="fill-gray-400 dark:fill-gray-500"
          />
        </marker>
        <marker
          id="arrowClosing"
          markerWidth="10"
          markerHeight="8"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M0,0 L10,4 L0,8 Z"
            className="fill-amber-600 dark:fill-amber-300"
          />
        </marker>
      </defs>

      {/* Subtle background ring (visual hint of the loop circumference) */}
      <circle
        cx={cx}
        cy={cy}
        r={perimeterRadius}
        fill="none"
        className="stroke-amber-100 dark:stroke-amber-900/40"
        strokeWidth={1}
        strokeDasharray="4 6"
      />

      {/* Demoted intermediary flow arcs (hairlines through the centre) */}
      {flowArcs.map((arc, i) => {
        // Curve gently toward the centre so they sit "inside" the ring
        const midX = (arc.from.x + arc.to.x) / 2
        const midY = (arc.from.y + arc.to.y) / 2
        const ctrlX = midX + (cx - midX) * 0.5
        const ctrlY = midY + (cy - midY) * 0.5

        const isHovered = hoveredNuclide === arc.nuclideKey
        const opacity = isHovered ? 0.8 : 0.2
        const strokeWidth = isHovered ? 2 : 1

        return (
          <path
            key={`flow-${i}`}
            d={`M${arc.from.x},${arc.from.y} Q${ctrlX},${ctrlY} ${arc.to.x},${arc.to.y}`}
            fill="none"
            stroke={arc.color.line}
            strokeWidth={strokeWidth}
            strokeOpacity={opacity}
            className="transition-all duration-150"
          />
        )
      })}

      {/* Closing edges: the regeneration arcs that make this a cycle.
          For each catalyst, draws an arc from the step that regenerates it
          back to the step that consumed it. The arc curves through the
          centre, visually showing the catalyst returning to be re-used. */}
      {closingEdges.map((edge, i) => {
        const midX = (edge.from.x + edge.to.x) / 2
        const midY = (edge.from.y + edge.to.y) / 2
        const ctrlX = midX + (cx - midX) * 1.15
        const ctrlY = midY + (cy - midY) * 1.15
        const color =
          edge.colorIdx !== undefined ? getFlowColor(edge.colorIdx).line : '#14b8a6' // teal fallback
        const isHovered = hoveredNuclide === edge.nuclideKey
        // Label position: 40% along the curve from the producer step toward
        // the control point — sits between the producer node and the centre,
        // off the catalyst-chip apex so it doesn't stack on the chip.
        const labelT = 0.4
        const labelX =
          (1 - labelT) * (1 - labelT) * edge.from.x +
          2 * (1 - labelT) * labelT * ctrlX +
          labelT * labelT * edge.to.x
        const labelY =
          (1 - labelT) * (1 - labelT) * edge.from.y +
          2 * (1 - labelT) * labelT * ctrlY +
          labelT * labelT * edge.to.y
        return (
          <g key={`close-${i}`} className="transition-all duration-150">
            <path
              d={`M${edge.from.x},${edge.from.y} Q${ctrlX},${ctrlY} ${edge.to.x},${edge.to.y}`}
              fill="none"
              stroke={color}
              strokeWidth={isHovered ? 3 : 2.25}
              strokeDasharray="6 4"
              strokeOpacity={isHovered ? 0.95 : 0.75}
              strokeLinecap="round"
              markerEnd="url(#arrowClosing)"
            />
            {/* Label offset from the apex to leave room for the catalyst chip */}
            <g>
              <rect
                x={labelX - 28}
                y={labelY - 9}
                width={56}
                height={18}
                rx={9}
                className="fill-white dark:fill-gray-800"
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.85}
              />
              <text
                x={labelX}
                y={labelY + 4}
                textAnchor="middle"
                className="fill-gray-700 dark:fill-gray-200 text-[10px] font-semibold"
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {edge.label}
              </text>
            </g>
          </g>
        )
      })}

      {/* Bold perimeter cycle arrows (one of which closes the loop). */}
      {perimeterArrows.map((arrow, i) => {
        // SVG arc: large-arc=0, sweep=1 (clockwise) along the perimeter circle
        const d = `M${arrow.from.x},${arrow.from.y} A${perimeterRadius},${perimeterRadius} 0 0 1 ${arrow.to.x},${arrow.to.y}`
        return (
          <path
            key={`peri-${i}`}
            d={d}
            fill="none"
            className="stroke-amber-500 dark:stroke-amber-400"
            strokeWidth={4}
            strokeLinecap="round"
            markerEnd="url(#arrowPerimeter)"
          />
        )
      })}

      {/* Byproduct rays */}
      {byproductRays.map((ray, i) => {
        const isHovered = hoveredNuclide === ray.nuclideKey
        return (
          <g key={`bp-${i}`} className="transition-all duration-150">
            <line
              x1={ray.from.x}
              y1={ray.from.y}
              x2={ray.to.x}
              y2={ray.to.y}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeWidth={isHovered ? 1.6 : 1}
              strokeOpacity={isHovered ? 0.9 : 0.55}
              markerEnd="url(#arrowByproduct)"
            />
            <text
              x={ray.to.x}
              y={ray.to.y}
              textAnchor={ray.to.x < cx ? 'end' : 'start'}
              dx={ray.to.x < cx ? -4 : 4}
              dy={4}
              className="fill-gray-500 dark:fill-gray-400 text-[10px] font-semibold"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {nuclideLabelByKey.get(ray.nuclideKey) ?? ray.nuclideKey}
            </text>
          </g>
        )
      })}

      {/* Reaction nodes */}
      {reactions.map((reaction, i) => {
        const pos = nodePositions[i]
        const x = pos.x - nodeW / 2
        const y = pos.y - nodeH / 2

        const inputStr = reaction.inputs.map((nn) => `${nn.A}${nn.E}`).join(' + ')
        const outputStr = reaction.outputs.map((nn) => `${nn.A}${nn.E}`).join(' + ')

        const isFeedback = reaction.isFeedback
        const borderColor = isFeedback
          ? 'stroke-amber-400 dark:stroke-amber-500'
          : 'stroke-gray-300 dark:stroke-gray-600'

        return (
          <g key={`node-${i}`}>
            <rect
              x={x}
              y={y}
              width={nodeW}
              height={nodeH}
              rx={10}
              className={`fill-white dark:fill-gray-800 ${borderColor}`}
              strokeWidth={isFeedback ? 2.5 : 1.5}
            />
            {/* Step number badge */}
            <circle
              cx={x + 16}
              cy={y + 16}
              r={11}
              className={`${
                isFeedback
                  ? 'fill-amber-100 dark:fill-amber-900/60 stroke-amber-400 dark:stroke-amber-600'
                  : 'fill-gray-100 dark:fill-gray-700 stroke-gray-300 dark:stroke-gray-600'
              }`}
              strokeWidth={1}
            />
            <text
              x={x + 16}
              y={y + 20}
              textAnchor="middle"
              className="fill-gray-700 dark:fill-gray-300 text-[11px] font-bold"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {i + 1}
            </text>
            {/* Reaction type label */}
            <text
              x={x + 32}
              y={y + 20}
              className={`text-[9px] font-bold uppercase ${
                reaction.type === 'fusion'
                  ? 'fill-blue-600 dark:fill-blue-400'
                  : reaction.type === 'twotwo'
                    ? 'fill-purple-600 dark:fill-purple-400'
                    : 'fill-red-600 dark:fill-red-400'
              }`}
              style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.05em' }}
            >
              {reaction.type === 'twotwo' ? '2→2' : reaction.type.toUpperCase()}
            </text>
            {/* Energy */}
            <text
              x={x + nodeW - 12}
              y={y + 20}
              textAnchor="end"
              className="fill-green-600 dark:fill-green-400 text-[10px] font-semibold"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              {reaction.MeV >= 0 ? '+' : ''}
              {reaction.MeV.toFixed(1)} MeV
            </text>
            {/* Equation */}
            <text
              x={x + nodeW / 2}
              y={y + 42}
              textAnchor="middle"
              className="fill-gray-800 dark:fill-gray-200 text-[12px] font-medium"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {inputStr}
              <tspan className="fill-gray-400 dark:fill-gray-500"> → </tspan>
              {outputStr}
            </text>
          </g>
        )
      })}

      {/* Centre — the recycled catalyst(s), or fuel if no catalysts detected.
          A catalyst is consumed at one step and regenerated at a later step,
          so it is what defines this as a cycle. Fuel (cycle.fuelNuclides) is
          the search seed: net consumed, not regenerated — distinct from the
          catalyst and shown elsewhere. */}
      <g>
        {(() => {
          const centerList = catalysts.length > 0 ? catalysts : cycle.fuelNuclides
          const isCatalyst = catalysts.length > 0
          const slotW = 60
          const totalW = centerList.length * slotW
          const startX = cx - totalW / 2 + slotW / 2
          return centerList.map((nn, i) => {
            const fx = startX + i * slotW
            const fy = cy - 8
            const isHovered = hoveredNuclide === nKey(nn)
            return (
              <g key={`center-${i}`}>
                <rect
                  x={fx - 26}
                  y={fy - 14}
                  width={52}
                  height={28}
                  rx={14}
                  className={
                    isCatalyst
                      ? 'fill-teal-100 dark:fill-teal-900/50 stroke-teal-500 dark:stroke-teal-400'
                      : 'fill-amber-100 dark:fill-amber-900/50 stroke-amber-300 dark:stroke-amber-700'
                  }
                  strokeWidth={isHovered ? 2.5 : isCatalyst ? 2 : 1.5}
                />
                <text
                  x={fx}
                  y={fy + 5}
                  textAnchor="middle"
                  className={
                    isCatalyst
                      ? 'fill-teal-800 dark:fill-teal-200 text-[12px] font-semibold'
                      : 'fill-amber-800 dark:fill-amber-200 text-[12px] font-semibold'
                  }
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  <tspan className="text-[9px]" dy={-3}>
                    {nn.A}
                  </tspan>
                  <tspan dy={3}>{nn.E}</tspan>
                </text>
              </g>
            )
          })
        })()}
        {/* Caption below — labels what the centre actually is */}
        <text
          x={cx}
          y={cy + 32}
          textAnchor="middle"
          className={
            catalysts.length > 0
              ? 'fill-teal-700 dark:fill-teal-400 text-[10px] font-bold uppercase'
              : 'fill-amber-700 dark:fill-amber-400 text-[10px] font-bold uppercase'
          }
          style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.1em' }}
        >
          {catalysts.length > 0
            ? t('cycleDiscovery.catalystCenterLabel')
            : t('cycleDiscovery.fuelLabel')}
        </text>
        <text
          x={cx}
          y={cy + 48}
          textAnchor="middle"
          className="fill-gray-500 dark:fill-gray-400 text-[10px] italic"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          ← reactions cycle around catalyst →
        </text>
      </g>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Enhanced Step List with Flow Indicators
// ---------------------------------------------------------------------------

function EnhancedStepList({
  cycle,
  fuelKeys,
  flows,
  byproducts,
  feedbackNuclides,
  nuclideColorMap,
  hoveredNuclide,
  onHover,
  catalysts,
}: {
  cycle: DiscoveredCycle
  fuelKeys: Set<NuclideKey>
  flows: FlowEdge[]
  byproducts: Map<number, NuclideKey[]>
  feedbackNuclides: Set<NuclideKey>
  nuclideColorMap: Map<NuclideKey, number>
  hoveredNuclide: NuclideKey | null
  onHover: (key: NuclideKey | null) => void
  catalysts: Array<{ E: string; Z: number; A: number }>
}) {
  const { t } = useTranslation()

  // Build lookup: for a given step and nuclide, which step produced it?
  const inputSource = new Map<string, number>() // "stepIdx:nuclideKey" -> fromStep
  for (const f of flows) {
    inputSource.set(`${f.toStep}:${f.nuclideKey}`, f.fromStep)
  }

  // Build lookup: for a given step and nuclide, which step consumes it?
  const outputDest = new Map<string, number[]>() // "stepIdx:nuclideKey" -> [toStep, ...]
  for (const f of flows) {
    const key = `${f.fromStep}:${f.nuclideKey}`
    if (!outputDest.has(key)) outputDest.set(key, [])
    outputDest.get(key)!.push(f.toStep)
  }

  const stepByproducts = byproducts

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {cycle.reactions.map((reaction, index) => {
        const isFeedback = reaction.isFeedback

        return (
          <div
            key={index}
            className={`px-6 py-5 ${isFeedback ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
          >
            <div className="flex items-start gap-4">
              {/* Step number with vertical connector */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                  isFeedback
                    ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 ring-2 ring-amber-300 dark:ring-amber-600'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {index + 1}
                </div>
                {index < cycle.reactions.length - 1 && (
                  <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-1" />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <ReactionTypeBadge type={reaction.type} />
                  {isFeedback && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      <RefreshCw className="w-3 h-3" />
                      {t('cycleDiscovery.feedbackLabel')}
                    </span>
                  )}
                  <span className="text-sm font-mono font-medium text-green-700 dark:text-green-400 ml-auto">
                    {reaction.MeV >= 0 ? '+' : ''}{reaction.MeV.toFixed(2)} MeV
                  </span>
                </div>

                {/* Reaction equation with flow annotations */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Inputs */}
                  {reaction.inputs.map((n, i) => {
                    const key = nKey(n)
                    const isFuel = fuelKeys.has(key)
                    const sourceStep = inputSource.get(`${index}:${key}`)
                    const colorIdx = nuclideColorMap.get(key)
                    const flowColor = colorIdx !== undefined ? getFlowColor(colorIdx) : null

                    const variant = isFuel ? 'fuel' as const : 'default' as const
                    const colorClass = (!isFuel && flowColor)
                      ? `${flowColor.bg} ${flowColor.text} ring-1 ${flowColor.ring}`
                      : undefined

                    return (
                      <span key={`in-${i}`} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-400 dark:text-gray-500 text-sm">+</span>}
                        <span className="relative">
                          {sourceStep !== undefined && (
                            <span className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold whitespace-nowrap ${flowColor ? flowColor.text : 'text-gray-400'}`}>
                              {t('cycleDiscovery.flowFromStep', { step: sourceStep + 1 })}
                            </span>
                          )}
                          <NuclideBadge
                            nuclide={n}
                            variant={variant}
                            colorClass={colorClass}
                            isHighlighted={hoveredNuclide === key}
                            isDimmed={hoveredNuclide !== null && hoveredNuclide !== key}
                            onHover={onHover}
                          />
                        </span>
                      </span>
                    )
                  })}

                  <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 mx-1 flex-shrink-0" />

                  {/* Outputs */}
                  {reaction.outputs.map((n, i) => {
                    const key = nKey(n)
                    const isFuel = fuelKeys.has(key)
                    const isFeedbackNuclide = feedbackNuclides.has(key) && isFeedback
                    const destinations = outputDest.get(`${index}:${key}`)
                    const isByproduct = stepByproducts.get(index)?.includes(key)
                    const colorIdx = nuclideColorMap.get(key)
                    const flowColor = colorIdx !== undefined ? getFlowColor(colorIdx) : null

                    // Role/identity split:
                    //   chip color = nuclide identity (per-nuclide flow color)
                    //   ring thickness = role (catalyst = ring-2, intermediary = ring-1)
                    const variant = isByproduct
                      ? 'byproduct' as const
                      : isFuel
                        ? 'fuel' as const
                        : 'default' as const

                    const colorClass = (!isFuel && !isByproduct && flowColor)
                      ? `${flowColor.bg} ${flowColor.text} ${isFeedbackNuclide ? 'ring-2' : 'ring-1'} ${flowColor.ring}`
                      : undefined

                    // Combined annotation: catalyst-and-forward gets a single
                    // line "regenerated · → step X" instead of two stacked
                    // labels at the same vertical position.
                    const annotationParts: string[] = []
                    if (isFeedbackNuclide) annotationParts.push(t('cycleDiscovery.flowRegenerated'))
                    if (destinations && destinations.length > 0) {
                      annotationParts.push(
                        t('cycleDiscovery.flowToStep', {
                          step: destinations.map((d) => d + 1).join(', '),
                        })
                      )
                    }
                    const annotationText = annotationParts.join(' · ')
                    const annotationColor = isFeedbackNuclide
                      ? (flowColor ? flowColor.text : 'text-gray-700 dark:text-gray-300')
                      : (flowColor ? flowColor.text : 'text-gray-400')

                    return (
                      <span key={`out-${i}`} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-400 dark:text-gray-500 text-sm">+</span>}
                        <span className="relative">
                          <NuclideBadge
                            nuclide={n}
                            variant={variant}
                            colorClass={colorClass}
                            isHighlighted={hoveredNuclide === key}
                            isDimmed={hoveredNuclide !== null && hoveredNuclide !== key}
                            onHover={onHover}
                          />
                          {annotationText && !isByproduct && (
                            <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] ${isFeedbackNuclide ? 'font-bold' : 'font-semibold'} whitespace-nowrap ${annotationColor}`}>
                              {annotationText}
                            </span>
                          )}
                          {isByproduct && (
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-medium whitespace-nowrap text-gray-400 dark:text-gray-500">
                              {t('cycleDiscovery.flowByproduct')}
                            </span>
                          )}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Cycle closure footer */}
      <div className="px-6 py-4 border-t-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10">
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {t('cycleDiscovery.cycleClosesLabel')}
          </span>
          {catalysts.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              {catalysts.map((n, i) => (
                <NuclideBadge key={`close-${i}`} nuclide={n} variant="feedback" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function FlowLegend({ feedbackNuclides }: { feedbackNuclides: Set<NuclideKey> }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-amber-200 dark:bg-amber-800 ring-1 ring-amber-400 dark:ring-amber-600" />
        {t('cycleDiscovery.legendFuel')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-sky-200 dark:bg-sky-800 ring-1 ring-sky-400 dark:ring-sky-600" />
        {t('cycleDiscovery.legendIntermediary')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-600" />
        {t('cycleDiscovery.legendByproduct')}
      </span>
      {feedbackNuclides.size > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-teal-200 dark:bg-teal-800 ring-2 ring-teal-400 dark:ring-teal-500" />
          {t('cycleDiscovery.legendRegenerated')}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Net Cycle Summary (hero panel)
// ---------------------------------------------------------------------------

function NetCycleSummary({
  cycle,
  byproducts,
  catalysts,
}: {
  cycle: DiscoveredCycle
  byproducts: Map<number, NuclideKey[]>
  feedbackNuclides: Set<NuclideKey>
  catalysts: Array<{ E: string; Z: number; A: number }>
}) {
  const { t } = useTranslation()

  // Build a lookup of all nuclide objects by NuclideKey from reaction outputs
  // so we can resolve byproduct keys back to {E, Z, A}.
  const nuclideByKey = useMemo(() => {
    const map = new Map<NuclideKey, { E: string; Z: number; A: number }>()
    for (const reaction of cycle.reactions) {
      for (const out of reaction.outputs) {
        const key = nKey(out)
        if (!map.has(key)) map.set(key, out)
      }
      for (const inp of reaction.inputs) {
        const key = nKey(inp)
        if (!map.has(key)) map.set(key, inp)
      }
    }
    return map
  }, [cycle.reactions])

  // Flatten byproduct keys (preserve order, dedupe)
  const byproductNuclides = useMemo(() => {
    const seen = new Set<NuclideKey>()
    const result: Array<{ E: string; Z: number; A: number }> = []
    for (const keys of byproducts.values()) {
      for (const key of keys) {
        if (!seen.has(key)) {
          seen.add(key)
          const n = nuclideByKey.get(key)
          if (n) result.push(n)
        }
      }
    }
    return result
  }, [byproducts, nuclideByKey])

  return (
    <div className="card p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/5 border-amber-200 dark:border-amber-800/40">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {t('cycleDiscovery.netCycleSummary')}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
        {t('cycleDiscovery.netCycleSummaryCaption')}
      </p>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-3">
        {/* FUEL IN */}
        <div className="flex flex-col items-center md:items-start gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {t('cycleDiscovery.netLabelFuelIn')}
          </span>
          <div className="flex flex-wrap gap-1 justify-center md:justify-start">
            {cycle.fuelNuclides.map((n, i) => (
              <NuclideBadge key={`fin-${i}`} nuclide={n} variant="fuel" />
            ))}
          </div>
        </div>

        {/* Arrow + cycle symbol */}
        <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 flex-shrink-0">
          <ArrowRight className="w-5 h-5" />
          <RefreshCw className="w-6 h-6" />
          <ArrowRight className="w-5 h-5" />
        </div>

        {/* CATALYST RECOVERED — the species regenerated each iteration */}
        <div className="flex flex-col items-center md:items-start gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {catalysts.length > 0
              ? t('cycleDiscovery.netLabelCatalystOut')
              : t('cycleDiscovery.netLabelFuelOut')}
          </span>
          <div className="flex flex-wrap gap-1 justify-center md:justify-start">
            {(catalysts.length > 0 ? catalysts : cycle.fuelNuclides).map((n, i) => (
              <NuclideBadge key={`cout-${i}`} nuclide={n} variant="feedback" />
            ))}
          </div>
        </div>

        {/* Plus separator */}
        <div className="flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500 font-light flex-shrink-0">
          +
        </div>

        {/* NET ENERGY */}
        <div className="flex flex-col items-center md:items-start gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
            {t('cycleDiscovery.netLabelEnergy')}
          </span>
          <span className="font-mono text-base font-semibold text-green-700 dark:text-green-400">
            {cycle.totalEnergy >= 0 ? '+' : ''}
            {cycle.totalEnergy.toFixed(2)} MeV
          </span>
        </div>

        {/* Plus separator */}
        <div className="flex items-center justify-center text-2xl text-gray-400 dark:text-gray-500 font-light flex-shrink-0">
          +
        </div>

        {/* BYPRODUCTS */}
        <div className="flex flex-col items-center md:items-start gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {t('cycleDiscovery.netLabelByproducts')}
          </span>
          <div className="flex flex-wrap gap-1 justify-center md:justify-start">
            {byproductNuclides.length > 0 ? (
              byproductNuclides.map((n, i) => (
                <NuclideBadge key={`bp-${i}`} nuclide={n} variant="byproduct" />
              ))
            ) : (
              <span className="text-xs italic text-gray-500 dark:text-gray-500">
                {t('cycleDiscovery.netLabelNoByproducts')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CycleVisualization({
  cycle,
  onRunSimulation,
  onBack,
}: CycleVisualizationProps) {
  const { t } = useTranslation()
  const [hoveredNuclide, setHoveredNuclide] = useState<NuclideKey | null>(null)

  const fuelKeys = useMemo(
    () => new Set(cycle.fuelNuclides.map((n) => nKey(n))),
    [cycle.fuelNuclides]
  )

  const { flows, byproducts, feedbackNuclides } = useMemo(
    () => analyzeFlow(cycle.reactions, fuelKeys),
    [cycle.reactions, fuelKeys]
  )

  // Assign consistent colors to intermediary nuclides
  const nuclideColorMap = useMemo(() => {
    const map = new Map<NuclideKey, number>()
    let idx = 0
    const seen = new Set<NuclideKey>()
    for (const f of flows) {
      if (!seen.has(f.nuclideKey)) {
        map.set(f.nuclideKey, idx++)
        seen.add(f.nuclideKey)
      }
    }
    return map
  }, [flows])

  // Full nuclide lookup across the cycle's reactions
  const nuclideMap = useMemo(
    () => buildNuclideMap(cycle.reactions),
    [cycle.reactions]
  )

  // The actual CATALYSTS of this cycle: nuclides consumed at one step and
  // regenerated at a later step (computed by analyzeFlow as feedbackNuclides).
  // These define the cycle's identity and belong in the center of the diagram.
  // Distinct from cycle.fuelNuclides, which is the search seed (net consumed,
  // not regenerated).
  const catalysts = useMemo(() => {
    const list: Array<{ E: string; Z: number; A: number }> = []
    for (const key of feedbackNuclides) {
      const n = nuclideMap.get(key)
      if (n) list.push(n)
    }
    return list
  }, [feedbackNuclides, nuclideMap])

  const onHover = useCallback((key: NuclideKey | null) => {
    setHoveredNuclide(key)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={onBack}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                title={t('common.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('cycleDiscovery.cycleDetail')}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-1 ml-10">
              <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">
                {t('cycleDiscovery.fuelLabel')}:
              </span>
              {cycle.fuelNuclides.map((n, i) => (
                <NuclideBadge
                  key={i}
                  nuclide={n}
                  variant="fuel"
                  isHighlighted={hoveredNuclide === nKey(n)}
                  isDimmed={hoveredNuclide !== null && hoveredNuclide !== nKey(n)}
                  onHover={onHover}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => onRunSimulation(cycle)}
            className="btn btn-primary px-5 py-2.5"
          >
            <Play className="w-4 h-4 mr-2 inline" />
            {t('cycleDiscovery.runFullCascade')}
          </button>
        </div>
      </div>

      {/* Net Cycle Transformation hero panel */}
      <NetCycleSummary
        cycle={cycle}
        byproducts={byproducts}
        feedbackNuclides={feedbackNuclides}
        catalysts={catalysts}
      />

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Zap className="w-4 h-4 text-green-600 dark:text-green-400" />}
          label={t('cycleDiscovery.metricEnergy')}
          value={cycle.totalEnergy.toFixed(2)}
          unit="MeV"
          color=""
        />
        <MetricCard
          icon={<RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          label={t('cycleDiscovery.metricFeedback')}
          value={cycle.feedbackRatio.toFixed(0)}
          unit="%"
          color=""
        />
        <MetricCard
          icon={<Gem className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          label={t('cycleDiscovery.metricAbundance')}
          value={cycle.abundanceScore.toFixed(0)}
          unit="/100"
          color=""
        />
        <MetricCard
          icon={<Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          label={t('cycleDiscovery.metricStability')}
          value={cycle.stabilityScore.toFixed(0)}
          unit="/100"
          color=""
        />
      </div>

      {/* Cycle ring diagram */}
      {cycle.reactions.length >= 2 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('cycleDiscovery.transformationChain')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {t('cycleDiscovery.transformationChainDesc')}
          </p>
          <CycleLoopDiagram
            cycle={cycle}
            flows={flows}
            feedbackNuclides={feedbackNuclides}
            nuclideColorMap={nuclideColorMap}
            byproducts={byproducts}
            hoveredNuclide={hoveredNuclide}
            catalysts={catalysts}
          />
          <div className="mt-4">
            <FlowLegend feedbackNuclides={feedbackNuclides} />
          </div>
        </div>
      )}

      {/* Enhanced reaction steps */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('cycleDiscovery.reactionSteps')} ({cycle.reactions.length})
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('cycleDiscovery.reactionStepsDesc')}
          </p>
        </div>

        <EnhancedStepList
          cycle={cycle}
          fuelKeys={fuelKeys}
          flows={flows}
          byproducts={byproducts}
          feedbackNuclides={feedbackNuclides}
          nuclideColorMap={nuclideColorMap}
          hoveredNuclide={hoveredNuclide}
          onHover={onHover}
          catalysts={catalysts}
        />
      </div>
    </div>
  )
}
