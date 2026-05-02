import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Play,
  Zap,
  RefreshCw,
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

const FLOW_COLORS = [
  { line: '#0ea5e9', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-400 dark:ring-sky-600' },
  { line: '#8b5cf6', bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', ring: 'ring-violet-400 dark:ring-violet-600' },
  { line: '#10b981', bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-400 dark:ring-emerald-600' },
  { line: '#f59e0b', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-400 dark:ring-amber-600' },
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
  variant?: 'default' | 'fuel' | 'feedback' | 'byproduct'
  isHighlighted?: boolean
  isDimmed?: boolean
  onHover?: (key: NuclideKey | null) => void
  colorClass?: string
}) {
  const key = nKey(nuclide)

  const variantClasses = {
    default: 'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200',
    fuel: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-1 ring-amber-300 dark:ring-amber-700',
    feedback: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-2 ring-amber-400 dark:ring-amber-500',
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
// SVG Cycle Ring Diagram
// ---------------------------------------------------------------------------

function CycleRingDiagram({
  cycle,
  flows,
  feedbackNuclides,
  nuclideColorMap,
  hoveredNuclide,
}: {
  cycle: DiscoveredCycle
  flows: FlowEdge[]
  feedbackNuclides: Set<NuclideKey>
  nuclideColorMap: Map<NuclideKey, number>
  hoveredNuclide: NuclideKey | null
}) {
  const { reactions } = cycle
  const n = reactions.length

  // Layout: reactions as nodes around a circle
  const cx = 260
  const cy = 240
  const radius = Math.min(180, 100 + n * 20)
  const nodeW = 200
  const nodeH = 56

  // Angle for each reaction node (starting from top, going clockwise)
  const angles = reactions.map((_, i) => (i / n) * 2 * Math.PI - Math.PI / 2)

  // Node positions (center of each node)
  const nodePositions = angles.map((a) => ({
    x: cx + radius * Math.cos(a),
    y: cy + radius * Math.sin(a),
  }))

  const svgW = cx * 2 + 20
  const svgH = cy * 2 + 20

  // Build flow arcs between nodes
  const flowArcs = flows.map((f) => {
    const from = nodePositions[f.fromStep]
    const to = nodePositions[f.toStep]
    const colorIdx = nuclideColorMap.get(f.nuclideKey) ?? 0
    const color = getFlowColor(colorIdx)
    return { ...f, from, to, color }
  })

  // Feedback arc: from last step back to step 0
  const feedbackArc = feedbackNuclides.size > 0 ? {
    from: nodePositions[n - 1],
    to: nodePositions[0],
    nuclideKeys: Array.from(feedbackNuclides),
  } : null

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full max-w-2xl mx-auto"
      style={{ maxHeight: 520 }}
    >
      <defs>
        <marker id="arrowFlow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6" className="fill-gray-400 dark:fill-gray-500" />
        </marker>
        <marker id="arrowFeedback" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <path d="M0,0 L10,3.5 L0,7" className="fill-amber-500 dark:fill-amber-400" />
        </marker>
      </defs>

      {/* Connection arcs between steps (sequential) */}
      {reactions.map((_, i) => {
        if (i >= n - 1) return null
        const from = nodePositions[i]
        const to = nodePositions[i + 1]
        // Straight line along the ring
        return (
          <line
            key={`seq-${i}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )
      })}

      {/* Flow arcs showing nuclide transfer */}
      {flowArcs.map((arc, i) => {
        const dx = arc.to.x - arc.from.x
        const dy = arc.to.y - arc.from.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        // Curve outward from center
        const midX = (arc.from.x + arc.to.x) / 2
        const midY = (arc.from.y + arc.to.y) / 2
        const perpX = -dy / dist
        const perpY = dx / dist
        // Curve away from center
        const toCenterX = cx - midX
        const toCenterY = cy - midY
        const dot = perpX * toCenterX + perpY * toCenterY
        const sign = dot > 0 ? -1 : 1
        const curveAmount = Math.min(40, dist * 0.3)
        const ctrlX = midX + sign * perpX * curveAmount
        const ctrlY = midY + sign * perpY * curveAmount

        const isActive = hoveredNuclide === arc.nuclideKey || !hoveredNuclide

        return (
          <path
            key={`flow-${i}`}
            d={`M${arc.from.x},${arc.from.y} Q${ctrlX},${ctrlY} ${arc.to.x},${arc.to.y}`}
            fill="none"
            stroke={arc.color.line}
            strokeWidth={isActive ? 3 : 1.5}
            strokeOpacity={isActive ? 0.8 : 0.15}
            markerEnd="url(#arrowFlow)"
            className="transition-all duration-150"
          />
        )
      })}

      {/* Feedback arc (cycle closure) */}
      {feedbackArc && (() => {
        const from = feedbackArc.from
        const to = feedbackArc.to
        const dx = to.x - from.x
        const dy = to.y - from.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2
        const perpX = -dy / dist
        const perpY = dx / dist
        const toCenterX = cx - midX
        const toCenterY = cy - midY
        const dot = perpX * toCenterX + perpY * toCenterY
        const sign = dot > 0 ? -1 : 1
        const curveAmount = Math.max(50, dist * 0.4)
        const ctrlX = midX + sign * perpX * curveAmount
        const ctrlY = midY + sign * perpY * curveAmount

        const isActive = !hoveredNuclide || feedbackArc.nuclideKeys.some(k => k === hoveredNuclide)

        return (
          <path
            d={`M${from.x},${from.y} Q${ctrlX},${ctrlY} ${to.x},${to.y}`}
            fill="none"
            className="stroke-amber-500 dark:stroke-amber-400 transition-all duration-150"
            strokeWidth={isActive ? 3.5 : 2}
            strokeOpacity={isActive ? 0.9 : 0.2}
            strokeDasharray="8 4"
            markerEnd="url(#arrowFeedback)"
          />
        )
      })()}

      {/* Reaction nodes */}
      {reactions.map((reaction, i) => {
        const pos = nodePositions[i]
        const x = pos.x - nodeW / 2
        const y = pos.y - nodeH / 2

        const inputStr = reaction.inputs.map(n => `${n.A}${n.E}`).join(' + ')
        const outputStr = reaction.outputs.map(n => `${n.A}${n.E}`).join(' + ')

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
              className={`${isFeedback ? 'fill-amber-100 dark:fill-amber-900/60 stroke-amber-400 dark:stroke-amber-600' : 'fill-gray-100 dark:fill-gray-700 stroke-gray-300 dark:stroke-gray-600'}`}
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
                reaction.type === 'fusion' ? 'fill-blue-600 dark:fill-blue-400'
                : reaction.type === 'twotwo' ? 'fill-purple-600 dark:fill-purple-400'
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
              {reaction.MeV >= 0 ? '+' : ''}{reaction.MeV.toFixed(1)} MeV
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
            {/* Feedback glow */}
            {isFeedback && (
              <text
                x={x + nodeW / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-amber-600 dark:fill-amber-400 text-[9px] font-bold uppercase"
                style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.08em' }}
              >
                ↻ REGENERATES CATALYST
              </text>
            )}
          </g>
        )
      })}

      {/* Center label */}
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        className="fill-gray-400 dark:fill-gray-500 text-[11px] font-medium uppercase"
        style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.1em' }}
      >
        Catalytic
      </text>
      <text
        x={cx}
        y={cy + 8}
        textAnchor="middle"
        className="fill-gray-400 dark:fill-gray-500 text-[11px] font-medium uppercase"
        style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.1em' }}
      >
        Cycle
      </text>
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
}: {
  cycle: DiscoveredCycle
  fuelKeys: Set<NuclideKey>
  flows: FlowEdge[]
  byproducts: Map<number, NuclideKey[]>
  feedbackNuclides: Set<NuclideKey>
  nuclideColorMap: Map<NuclideKey, number>
  hoveredNuclide: NuclideKey | null
  onHover: (key: NuclideKey | null) => void
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

                    const variant = isFeedbackNuclide
                      ? 'feedback' as const
                      : isByproduct
                        ? 'byproduct' as const
                        : isFuel
                          ? 'fuel' as const
                          : 'default' as const

                    const colorClass = (!isFuel && !isFeedbackNuclide && !isByproduct && flowColor)
                      ? `${flowColor.bg} ${flowColor.text} ring-1 ${flowColor.ring}`
                      : undefined

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
                          {destinations && destinations.length > 0 && (
                            <span className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-semibold whitespace-nowrap ${flowColor ? flowColor.text : 'text-gray-400'}`}>
                              {t('cycleDiscovery.flowToStep', { step: destinations.map(d => d + 1).join(', ') })}
                            </span>
                          )}
                          {isFeedbackNuclide && (
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap text-amber-600 dark:text-amber-400">
                              {t('cycleDiscovery.flowRegenerated')}
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
          <span className="w-3 h-3 rounded-full bg-amber-200 dark:bg-amber-800 ring-2 ring-amber-400 dark:ring-amber-500" />
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
}: {
  cycle: DiscoveredCycle
  byproducts: Map<number, NuclideKey[]>
  feedbackNuclides: Set<NuclideKey>
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

        {/* FUEL OUT (recovered) */}
        <div className="flex flex-col items-center md:items-start gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            {t('cycleDiscovery.netLabelFuelOut')}
          </span>
          <div className="flex flex-wrap gap-1 justify-center md:justify-start">
            {cycle.fuelNuclides.map((n, i) => (
              <NuclideBadge key={`fout-${i}`} nuclide={n} variant="fuel" />
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
          <CycleRingDiagram
            cycle={cycle}
            flows={flows}
            feedbackNuclides={feedbackNuclides}
            nuclideColorMap={nuclideColorMap}
            hoveredNuclide={hoveredNuclide}
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
        />
      </div>
    </div>
  )
}
