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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import type { DiscoveredCycle, CycleReaction } from '../types'

interface CycleVisualizationProps {
  cycle: DiscoveredCycle
  onRunSimulation: (cycle: DiscoveredCycle) => void
  onBack: () => void
  onPrev?: () => void
  onNext?: () => void
  currentIndex?: number
  totalCount?: number
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
// Layout constants for the circular cycle diagram (CycleNetworkDiagram).
// Pixel measurements assume the SVG is drawn at the natural size below; CSS
// scales it down on smaller viewports.
// ---------------------------------------------------------------------------

/** Geometric constants for the circular layout of reaction nodes. */
const LAYOUT = {
  /** Centre X of the circular layout. */
  cx: 320,
  /** Centre Y of the circular layout. */
  cy: 280,
  /** Width of each reaction node rectangle. */
  nodeW: 200,
  /** Height of each reaction node rectangle. */
  nodeH: 56,
  /** Padding added around (cx,cy) to compute SVG width/height. */
  canvasPadding: 40,
  /** Minimum radius for the node ring — n=1..4 stays at the floor. */
  radiusFloor: 110,
  /** Maximum radius cap so very-large cycles don't push nodes off-canvas. */
  radiusCap: 200,
  /** Radius added per additional reaction node beyond the floor count. */
  radiusPerNode: 22,
  /** Fraction of node width used to bias the perimeter radius outward. */
  perimeterNodeWidthShare: 0.35,
  /** Outward bias factor applied to whichever dim wins between H and W*share. */
  perimeterRadiusBias: 0.6,
  /** Inner edge of node-emission rays, measured from node centre. */
  rayStartScale: 0.55,
  /** Outward extension past the perimeter where emission rays end. */
  rayEndExtension: 32,
  /** Closing-arc bend factor: base + (proportional to chord/diameter ratio). */
  closingArcBendBase: 0.2,
  /** Additional bend factor scaled by chord-to-diameter ratio. */
  closingArcBendRange: 0.4,
} as const

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
  hoveredStep,
  catalysts,
  onHover,
  onStepHover,
}: {
  cycle: DiscoveredCycle
  flows: FlowEdge[]
  feedbackNuclides: Set<NuclideKey>
  nuclideColorMap: Map<NuclideKey, number>
  byproducts: Map<number, NuclideKey[]>
  hoveredNuclide: NuclideKey | null
  hoveredStep: number | null
  catalysts: Array<{ E: string; Z: number; A: number }>
  onHover: (key: NuclideKey | null) => void
  onStepHover: (idx: number | null) => void
}) {
  // Centralised hit-state for arcs: an arc is highlighted when its nuclide
  // is hovered, or when either of its endpoint steps is hovered.
  const arcHit = (nuclideKey: NuclideKey, fromStep: number, toStep: number) =>
    hoveredNuclide === nuclideKey ||
    hoveredStep === fromStep ||
    hoveredStep === toStep
  const { t } = useTranslation()
  const { reactions } = cycle
  const n = reactions.length

  // Layout
  const { cx, cy, nodeW, nodeH } = LAYOUT
  const radius = Math.min(
    LAYOUT.radiusCap,
    LAYOUT.radiusFloor + n * LAYOUT.radiusPerNode
  )

  // Angle for each reaction node (starting from top, going clockwise)
  const angles = reactions.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2)

  // Node centre positions
  const nodePositions = angles.map((a) => ({
    x: cx + radius * Math.cos(a),
    y: cy + radius * Math.sin(a),
  }))

  // Shorten an arc endpoint so it stops at the node's bounding rectangle
  // (plus a small margin) instead of at the node's centre. Without this,
  // arrowhead markers render inside the rectangle and are invisible.
  //
  // Snaps the endpoint to the MIDPOINT of the closest cardinal face (top,
  // bottom, left, or right) of the destination node, rather than wherever
  // the line from ctrl to dest happens to cross the rect. Result: arrows
  // always enter destinations head-on at a face midpoint, never glancing
  // off a corner. The closest face is chosen by comparing the line's
  // slope to the node's aspect ratio.
  function snapToFaceMidpoint(
    to: { x: number; y: number },
    ctrl: { x: number; y: number },
    margin = 8
  ): { x: number; y: number } {
    const dx = to.x - ctrl.x
    const dy = to.y - ctrl.y
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return to
    // Horizontal motion dominates iff |dx|/W > |dy|/H, i.e. we'd hit a
    // left/right face before a top/bottom face when backtracking.
    const hitsVerticalFace = Math.abs(dx) * nodeH > Math.abs(dy) * nodeW
    if (hitsVerticalFace) {
      const faceX = to.x - Math.sign(dx) * (nodeW / 2 + margin)
      return { x: faceX, y: to.y }
    }
    const faceY = to.y - Math.sign(dy) * (nodeH / 2 + margin)
    return { x: to.x, y: faceY }
  }

  const svgW = cx * 2 + LAYOUT.canvasPadding
  const svgH = cy * 2 + LAYOUT.canvasPadding

  // Outer perimeter radius (where bold cycle arrows hug the outside of nodes)
  const perimeterRadius =
    radius +
    Math.max(nodeH, nodeW * LAYOUT.perimeterNodeWidthShare) *
      LAYOUT.perimeterRadiusBias

  // Build flow arcs (intermediary, demoted to hairlines through the centre)
  const flowArcs = flows.map((f) => {
    const from = nodePositions[f.fromStep]
    const to = nodePositions[f.toStep]
    const colorIdx = nuclideColorMap.get(f.nuclideKey) ?? 0
    const color = getFlowColor(colorIdx)
    return { ...f, from, to, color }
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
      const rayStartR = radius + nodeH * LAYOUT.rayStartScale
      const rayEndR = perimeterRadius + LAYOUT.rayEndExtension
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

  // Label-data accumulators, populated during the arc passes below and
  // re-rendered in a final pass AFTER reaction nodes so labels always paint
  // on top of node rectangles instead of being partially clipped by them.
  interface FlowLabelData {
    key: string
    nuclideKey: NuclideKey
    x: number
    y: number
    text: string
    color: string
    isHovered: boolean
  }
  interface ClosingLabelData {
    key: string
    nuclideKey: NuclideKey
    x: number
    y: number
    text: string
    color: string
    width: number
    height: number
    rx: number
    fontSize: number
  }
  const flowLabelData: FlowLabelData[] = []
  const closingLabelData: ClosingLabelData[] = []

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full max-w-3xl mx-auto"
      style={{ maxHeight: 600 }}
    >
      <defs>
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
        {/* Per-flow arrowheads: one marker per FLOW_COLOR so each
            intermediary hairline gets a directional chevron in its own color.
            referenced as url(#arrowFlow-N) by index. */}
        <marker id="arrowFlow-0" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,3 L0,6 Z" fill="#0ea5e9" />
        </marker>
        <marker id="arrowFlow-1" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,3 L0,6 Z" fill="#8b5cf6" />
        </marker>
        <marker id="arrowFlow-2" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,3 L0,6 Z" fill="#10b981" />
        </marker>
        <marker id="arrowFlow-3" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ef4444" />
        </marker>
        <marker id="arrowFlow-4" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ec4899" />
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

      {/* Intermediary flow arcs (hairlines through the centre).
          Each arc is directional (arrowhead) and labelled with its nuclide. */}
      {flowArcs.map((arc, i) => {
        // Curve toward the centre — bend amount scales with arc length so
        // adjacent-step arcs (short chord) hug the perimeter without yanking
        // sharply inward, while opposite-side arcs still bow through the
        // middle to avoid crossing unrelated nodes.
        const midX = (arc.from.x + arc.to.x) / 2
        const midY = (arc.from.y + arc.to.y) / 2
        const chordLen = Math.hypot(arc.to.x - arc.from.x, arc.to.y - arc.from.y)
        const bendFactor =
          LAYOUT.closingArcBendBase +
          LAYOUT.closingArcBendRange * Math.min(1, chordLen / (2 * radius))
        const ctrlX = midX + (cx - midX) * bendFactor
        const ctrlY = midY + (cy - midY) * bendFactor

        const isHovered = arcHit(arc.nuclideKey, arc.fromStep, arc.toStep)
        const opacity = isHovered ? 0.85 : 0.4
        const strokeWidth = isHovered ? 2 : 1.25
        const colorIdx = nuclideColorMap.get(arc.nuclideKey) ?? 0

        // Shorten the destination so the arrowhead clears the node rectangle
        const toShort = snapToFaceMidpoint(arc.to, { x: ctrlX, y: ctrlY })

        // Compute label position: Bezier point shifted toward the SOURCE
        // side (t=0.4) and offset perpendicular toward the centre. The
        // source-side shift keeps the label clear of the arrowhead landing
        // at the destination face; the perpendicular offset keeps it off
        // the line between adjacent nodes.
        const t = 0.4
        const bx =
          (1 - t) * (1 - t) * arc.from.x + 2 * (1 - t) * t * ctrlX + t * t * arc.to.x
        const by =
          (1 - t) * (1 - t) * arc.from.y + 2 * (1 - t) * t * ctrlY + t * t * arc.to.y
        const perpX = -(arc.to.y - arc.from.y) / (chordLen || 1)
        const perpY = (arc.to.x - arc.from.x) / (chordLen || 1)
        const sign = (cx - bx) * perpX + (cy - by) * perpY >= 0 ? 1 : -1
        const labelOffset = 20
        const lx = bx + perpX * sign * labelOffset
        const ly = by + perpY * sign * labelOffset
        const arcLabel = nuclideLabelByKey.get(arc.nuclideKey) ?? arc.nuclideKey

        // Queue label for the final pass (rendered after reaction nodes)
        flowLabelData.push({
          key: `flow-${i}`,
          nuclideKey: arc.nuclideKey,
          x: lx,
          y: ly,
          text: arcLabel,
          color: arc.color.line,
          isHovered,
        })

        return (
          <g
            key={`flow-${i}`}
            className="transition-all duration-150"
            onMouseEnter={() => onHover(arc.nuclideKey)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d={`M${arc.from.x},${arc.from.y} Q${ctrlX},${ctrlY} ${toShort.x},${toShort.y}`}
              fill="none"
              stroke={arc.color.line}
              strokeWidth={strokeWidth}
              strokeOpacity={opacity}
              strokeLinecap="round"
              markerEnd={`url(#arrowFlow-${colorIdx % 5})`}
              style={{ pointerEvents: 'stroke' }}
            />
          </g>
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
        const isHovered = arcHit(edge.nuclideKey, edge.fromStep, edge.toStep)
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
        // Shorten the destination so the arrowhead clears the node rectangle
        const toShortClose = snapToFaceMidpoint(edge.to, { x: ctrlX, y: ctrlY })

        // Mid-arc nuclide label — offset perpendicular toward the centre
        // so it sits off the curve in clear space.
        const closeChordLen = Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y)
        const cPerpX = -(edge.to.y - edge.from.y) / (closeChordLen || 1)
        const cPerpY = (edge.to.x - edge.from.x) / (closeChordLen || 1)
        const cSign =
          (cx - labelX) * cPerpX + (cy - labelY) * cPerpY >= 0 ? 1 : -1
        const lblOffset = 22
        const midLabelX = labelX + cPerpX * cSign * lblOffset
        const midLabelY = labelY + cPerpY * cSign * lblOffset

        // Destination-step label sits OUTSIDE the destination node, just
        // past the arrowhead's face-midpoint entry. Snap to the same face
        // with a larger margin so the label clears the box cleanly.
        const tipPos = snapToFaceMidpoint(edge.to, { x: ctrlX, y: ctrlY }, 24)
        const tipX = tipPos.x
        const tipY = tipPos.y

        closingLabelData.push({
          key: `close-mid-${i}`,
          nuclideKey: edge.nuclideKey,
          x: midLabelX,
          y: midLabelY,
          text: edge.label,
          color,
          width: 64,
          height: 20,
          rx: 10,
          fontSize: 12,
        })
        closingLabelData.push({
          key: `close-tip-${i}`,
          nuclideKey: edge.nuclideKey,
          x: tipX,
          y: tipY,
          text: `→ step ${edge.toStep + 1}`,
          color,
          width: 56,
          height: 18,
          rx: 9,
          fontSize: 11,
        })

        return (
          <g
            key={`close-${i}`}
            className="transition-all duration-150"
            onMouseEnter={() => onHover(edge.nuclideKey)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: 'pointer' }}
          >
            <path
              d={`M${edge.from.x},${edge.from.y} Q${ctrlX},${ctrlY} ${toShortClose.x},${toShortClose.y}`}
              fill="none"
              stroke={color}
              strokeWidth={isHovered ? 3 : 2.25}
              strokeDasharray="6 4"
              strokeOpacity={isHovered ? 0.95 : 0.75}
              strokeLinecap="round"
              markerEnd="url(#arrowClosing)"
              style={{ pointerEvents: 'stroke' }}
            />
          </g>
        )
      })}

      {/* Byproduct rays */}
      {byproductRays.map((ray, i) => {
        const isHovered =
          hoveredNuclide === ray.nuclideKey || hoveredStep === ray.stepIdx
        return (
          <g
            key={`bp-${i}`}
            className="transition-all duration-150"
            onMouseEnter={() => onHover(ray.nuclideKey)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: 'pointer' }}
          >
            <line
              x1={ray.from.x}
              y1={ray.from.y}
              x2={ray.to.x}
              y2={ray.to.y}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeWidth={isHovered ? 1.6 : 1}
              strokeOpacity={isHovered ? 0.9 : 0.55}
              markerEnd="url(#arrowByproduct)"
              style={{ pointerEvents: 'stroke' }}
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
        const isStepHovered = hoveredStep === i
        const borderColor = isStepHovered
          ? 'stroke-primary-500 dark:stroke-primary-400'
          : isFeedback
            ? 'stroke-amber-400 dark:stroke-amber-500'
            : 'stroke-gray-300 dark:stroke-gray-600'

        return (
          <g
            key={`node-${i}`}
            onMouseEnter={() => onStepHover(i)}
            onMouseLeave={() => onStepHover(null)}
            style={{ cursor: 'pointer' }}
            className="transition-all duration-150"
          >
            <rect
              x={x}
              y={y}
              width={nodeW}
              height={nodeH}
              rx={10}
              className={`fill-white dark:fill-gray-800 ${borderColor}`}
              strokeWidth={isStepHovered ? 2.5 : isFeedback ? 2.5 : 1.5}
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

      {/* Arc labels — rendered AFTER reaction nodes so they always paint on
          top of node rectangles, never clipped by them. Data was queued
          into flowLabelData / closingLabelData during the arc passes. */}
      {flowLabelData.map((lbl) => (
        <g
          key={lbl.key}
          opacity={lbl.isHovered ? 1 : 0.75}
          onMouseEnter={() => onHover(lbl.nuclideKey)}
          onMouseLeave={() => onHover(null)}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={lbl.x - 22}
            y={lbl.y - 9}
            width={44}
            height={18}
            rx={9}
            className="fill-white dark:fill-gray-800"
            stroke={lbl.color}
            strokeWidth={1}
            strokeOpacity={0.8}
          />
          <text
            x={lbl.x}
            y={lbl.y + 4}
            textAnchor="middle"
            className="fill-gray-700 dark:fill-gray-200 text-[11px] font-semibold"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            {lbl.text}
          </text>
        </g>
      ))}
      {closingLabelData.map((lbl) => {
        const fontClass =
          lbl.fontSize >= 12 ? 'text-[12px]' : lbl.fontSize === 11 ? 'text-[11px]' : 'text-[10px]'
        const yOffset = lbl.fontSize >= 12 ? 4 : 4
        return (
          <g
            key={lbl.key}
            onMouseEnter={() => onHover(lbl.nuclideKey)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={lbl.x - lbl.width / 2}
              y={lbl.y - lbl.height / 2}
              width={lbl.width}
              height={lbl.height}
              rx={lbl.rx}
              className="fill-white dark:fill-gray-800"
              stroke={lbl.color}
              strokeWidth={1}
              strokeOpacity={0.85}
            />
            <text
              x={lbl.x}
              y={lbl.y + yOffset}
              textAnchor="middle"
              className={`fill-gray-700 dark:fill-gray-200 ${fontClass} font-semibold`}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {lbl.text}
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
  hoveredStep,
  onHover,
  onStepHover,
  catalysts,
}: {
  cycle: DiscoveredCycle
  fuelKeys: Set<NuclideKey>
  flows: FlowEdge[]
  byproducts: Map<number, NuclideKey[]>
  feedbackNuclides: Set<NuclideKey>
  nuclideColorMap: Map<NuclideKey, number>
  hoveredNuclide: NuclideKey | null
  hoveredStep: number | null
  onHover: (key: NuclideKey | null) => void
  onStepHover: (idx: number | null) => void
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
        const isStepHovered = hoveredStep === index

        return (
          <div
            key={index}
            onMouseEnter={() => onStepHover(index)}
            onMouseLeave={() => onStepHover(null)}
            className={`px-6 py-5 transition-colors duration-150 cursor-default ${
              isStepHovered
                ? 'bg-primary-50 dark:bg-primary-900/20'
                : isFeedback
                  ? 'bg-amber-50/50 dark:bg-amber-900/10'
                  : ''
            }`}
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
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
      {/* Role pills */}
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-amber-200 dark:bg-amber-800 ring-1 ring-amber-400 dark:ring-amber-600" />
        {t('cycleDiscovery.legendFuel')}
      </span>
      {feedbackNuclides.size > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-teal-200 dark:bg-teal-800 ring-2 ring-teal-400 dark:ring-teal-500" />
          {t('cycleDiscovery.legendCatalyst')}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-600" />
        {t('cycleDiscovery.legendByproduct')}
      </span>
      {/* Arc treatments */}
      <span className="flex items-center gap-1.5">
        <svg width="22" height="8" className="flex-shrink-0">
          <line x1="0" y1="4" x2="18" y2="4" stroke="#0ea5e9" strokeWidth="1.5" />
          <path d="M16,1 L21,4 L16,7 Z" fill="#0ea5e9" />
        </svg>
        {t('cycleDiscovery.legendFlowSolid')}
      </span>
      {feedbackNuclides.size > 0 && (
        <span className="flex items-center gap-1.5">
          <svg width="22" height="8" className="flex-shrink-0">
            <line x1="0" y1="4" x2="18" y2="4" stroke="#14b8a6" strokeWidth="2" strokeDasharray="4 2" />
            <path d="M16,1 L21,4 L16,7 Z" fill="#14b8a6" />
          </svg>
          {t('cycleDiscovery.legendFlowDashed')}
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
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: CycleVisualizationProps) {
  const { t } = useTranslation()
  const [hoveredNuclide, setHoveredNuclide] = useState<NuclideKey | null>(null)
  const [hoveredStep, setHoveredStep] = useState<number | null>(null)

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

  const onStepHover = useCallback((idx: number | null) => {
    setHoveredStep(idx)
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
              {typeof totalCount === 'number' && totalCount > 1 && (
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={onPrev}
                    disabled={!onPrev}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t('common.previous')}
                    aria-label={t('common.previous')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums min-w-[3.5rem] text-center">
                    {(currentIndex ?? 0) + 1} / {totalCount}
                  </span>
                  <button
                    onClick={onNext}
                    disabled={!onNext}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t('common.next')}
                    aria-label={t('common.next')}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
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
            hoveredStep={hoveredStep}
            catalysts={catalysts}
            onHover={onHover}
            onStepHover={onStepHover}
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
          hoveredStep={hoveredStep}
          onHover={onHover}
          onStepHover={onStepHover}
          catalysts={catalysts}
        />
      </div>
    </div>
  )
}
