import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import {
  RUSSELL_OCTAVES,
  RUSSELL_COLORS,
  type RussellElement,
  type RussellOctave,
} from '../constants/russellElements'

interface RussellWaveDiagramProps {
  onElementClick?: (Z: number) => void
}

// Layout constants
const MARGIN = { top: 40, right: 30, bottom: 50, left: 60 }
const CHART_W = 1000
const CHART_H = 400
const SVG_W = CHART_W + MARGIN.left + MARGIN.right
const SVG_H = CHART_H + MARGIN.top + MARGIN.bottom
const DOT_R = 6
const CARBON_R = 9

/**
 * Amplitude envelope: bell curve peaking at octave 5 (Carbon's octave).
 * Returns 0..1 for octave numbers 1..10.
 */
function octaveEnvelope(octaveNumber: number): number {
  const peak = 5
  const sigma = 2.2
  const d = octaveNumber - peak
  return Math.exp(-(d * d) / (2 * sigma * sigma))
}

/**
 * Within-octave wave shape: generation side rises, inert gas is baseline,
 * radiation side descends. Position -4..-1 = rising, 0 = baseline, +1..+4 = falling.
 * Returns 0..1 for how far up the wave this position is.
 */
function positionAmplitude(position: number): number {
  if (position === 0) return 0 // inert gas at baseline
  if (position < 0) {
    // Generation: -4 = 0.25, -3 = 0.5, -2 = 0.75, -1 = 1.0
    return (position + 5) / 4
  }
  // Radiation: +1 = 0.75, +2 = 0.5, +3 = 0.25, +4 = 0.0
  return (4 - position) / 4
}

interface PlotPoint {
  el: RussellElement
  octave: RussellOctave
  x: number
  y: number
  amplitude: number
}

function getElementColor(el: RussellElement, isDark: boolean): string {
  const mode = isDark ? 'dark' : 'light'
  if (el.modernSymbol === 'C') return RUSSELL_COLORS.carbon[mode]
  if (el.status === 'hypothetical') return RUSSELL_COLORS.hypothetical[mode]
  if (el.status === 'predicted') return RUSSELL_COLORS.predicted[mode]
  if (el.side === 'inertGas') return RUSSELL_COLORS.inertGas[mode]
  if (el.side === 'generation') return RUSSELL_COLORS.generation[mode]
  return RUSSELL_COLORS.radiation[mode]
}

function getElementFill(el: RussellElement, isDark: boolean): string {
  const bgMode = isDark ? 'dark' : 'light'
  if (el.modernSymbol === 'C') return RUSSELL_COLORS.carbon.bg[bgMode]
  if (el.status === 'hypothetical') return RUSSELL_COLORS.hypothetical.bg[bgMode]
  if (el.status === 'predicted') return RUSSELL_COLORS.predicted.bg[bgMode]
  if (el.side === 'inertGas') return RUSSELL_COLORS.inertGas.bg[bgMode]
  if (el.side === 'generation') return RUSSELL_COLORS.generation.bg[bgMode]
  return RUSSELL_COLORS.radiation.bg[bgMode]
}

export default function RussellWaveDiagram({ onElementClick }: RussellWaveDiagramProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [hovered, setHovered] = useState<PlotPoint | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Compute all element plot points
  const points = useMemo(() => {
    const pts: PlotPoint[] = []
    let xIndex = 0

    // First pass: count total x positions
    let totalCount = 0
    for (const octave of RUSSELL_OCTAVES) {
      totalCount += octave.elements.length
      totalCount += 0.5 // gap between octaves
    }
    const maxX = totalCount - 0.5

    // Second pass: compute actual points
    xIndex = 0
    for (const octave of RUSSELL_OCTAVES) {
      for (const el of octave.elements) {
        const env = octaveEnvelope(octave.number)
        const posAmp = positionAmplitude(el.position)
        const amplitude = env * posAmp

        const x = MARGIN.left + (xIndex / maxX) * CHART_W
        const y = MARGIN.top + CHART_H - amplitude * CHART_H

        pts.push({ el, octave, x, y, amplitude })
        xIndex++
      }
      xIndex += 0.5
    }

    return pts
  }, [])

  // Build smooth wave envelope path through all points
  const wavePath = useMemo(() => {
    if (points.length < 2) return ''

    const pts = points.map(p => ({ x: p.x, y: p.y }))
    let d = `M ${pts[0].x} ${pts[0].y}`

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const dx = (curr.x - prev.x) / 3
      d += ` C ${prev.x + dx} ${prev.y}, ${curr.x - dx} ${curr.y}, ${curr.x} ${curr.y}`
    }

    return d
  }, [points])

  // Compute octave label positions (center x of each octave's elements)
  const octaveLabels = useMemo(() => {
    const labels: { x: number; number: number }[] = []
    let i = 0
    for (const octave of RUSSELL_OCTAVES) {
      const start = i
      i += octave.elements.length
      const mid = Math.floor((start + i - 1) / 2)
      if (points[mid]) {
        labels.push({ x: points[mid].x, number: octave.number })
      }
    }
    return labels
  }, [points])

  const handleMouseEnter = useCallback(
    (point: PlotPoint, e: React.MouseEvent) => {
      setHovered(point)
      const rect = (e.currentTarget as SVGElement)
        .closest('.russell-wave-container')
        ?.getBoundingClientRect()
      if (rect) {
        setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top - 10 })
      }
    },
    []
  )

  const handleMouseLeave = useCallback(() => {
    setHovered(null)
  }, [])

  const handleClick = useCallback(
    (el: RussellElement) => {
      if (el.Z) {
        if (onElementClick) {
          onElementClick(el.Z)
        } else {
          navigate(`/element-data?Z=${el.Z}`)
        }
      }
    },
    [navigate, onElementClick]
  )

  const axisColor = isDark ? '#6b7280' : '#9ca3af'
  const gridColor = isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(209, 213, 219, 0.5)'
  const waveStrokeColor = isDark ? 'rgba(156, 163, 175, 0.4)' : 'rgba(107, 114, 128, 0.3)'
  const textColor = isDark ? '#d1d5db' : '#374151'
  const baselineY = MARGIN.top + CHART_H

  return (
    <div className="russell-wave-container relative">
      <div className="overflow-x-auto">
        <svg
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="select-none"
        >
          {/* Y-axis label */}
          <text
            x={16}
            y={MARGIN.top + CHART_H / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={axisColor}
            fontSize={11}
            fontWeight="500"
            transform={`rotate(-90, 16, ${MARGIN.top + CHART_H / 2})`}
          >
            {t('russellChart.amplitude')}
          </text>

          {/* X-axis label */}
          <text
            x={MARGIN.left + CHART_W / 2}
            y={SVG_H - 8}
            textAnchor="middle"
            fill={axisColor}
            fontSize={11}
            fontWeight="500"
          >
            {t('russellChart.octaveAxis')}
          </text>

          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
            const y = MARGIN.top + CHART_H - frac * CHART_H
            return (
              <g key={`grid-${frac}`}>
                <line
                  x1={MARGIN.left}
                  y1={y}
                  x2={MARGIN.left + CHART_W}
                  y2={y}
                  stroke={gridColor}
                  strokeWidth={frac === 0 ? 1.5 : 0.5}
                  strokeDasharray={frac === 0 ? undefined : '4 4'}
                />
                {frac > 0 && (
                  <text
                    x={MARGIN.left - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={axisColor}
                    fontSize={9}
                  >
                    {Math.round(frac * 100)}%
                  </text>
                )}
              </g>
            )
          })}

          {/* Octave labels along x-axis */}
          {octaveLabels.map((label) => (
            <text
              key={`oct-label-${label.number}`}
              x={label.x}
              y={baselineY + 24}
              textAnchor="middle"
              fill={textColor}
              fontSize={11}
              fontWeight="500"
            >
              {label.number}
            </text>
          ))}

          {/* Wave envelope path */}
          <path
            d={wavePath}
            fill="none"
            stroke={waveStrokeColor}
            strokeWidth={2}
          />

          {/* Filled area under the wave */}
          {wavePath && (
            <path
              d={`${wavePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`}
              fill={isDark ? 'rgba(156, 163, 175, 0.05)' : 'rgba(107, 114, 128, 0.04)'}
            />
          )}

          {/* Element dots */}
          {points.map((point, i) => {
            const isCarbon = point.el.modernSymbol === 'C'
            const isHypothetical = point.el.status === 'hypothetical'
            const isPredicted = point.el.status === 'predicted'
            const isClickable = !!point.el.Z
            const r = isCarbon ? CARBON_R : DOT_R

            return (
              <g
                key={`dot-${i}`}
                className={isClickable ? 'cursor-pointer' : 'cursor-default'}
                onMouseEnter={(e) => handleMouseEnter(point, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(point.el)}
              >
                {/* Carbon glow */}
                {isCarbon && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={r + 4}
                    fill="none"
                    stroke={RUSSELL_COLORS.carbon[isDark ? 'dark' : 'light']}
                    strokeWidth={1.5}
                    opacity={0.4}
                  />
                )}

                {/* Dot */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={r}
                  fill={getElementFill(point.el, isDark)}
                  stroke={getElementColor(point.el, isDark)}
                  strokeWidth={isCarbon ? 2.5 : 1.5}
                  strokeDasharray={isHypothetical ? '3 2' : undefined}
                  opacity={isHypothetical ? 0.7 : 1}
                />

                {/* Predicted star */}
                {isPredicted && (
                  <text
                    x={point.x + r + 2}
                    y={point.y - r}
                    fill={RUSSELL_COLORS.predicted[isDark ? 'dark' : 'light']}
                    fontSize={8}
                    fontWeight="bold"
                  >
                    ★
                  </text>
                )}

                {/* Element symbol label */}
                {point.el.modernSymbol && (
                  <text
                    x={point.x}
                    y={point.y - r - 4}
                    textAnchor="middle"
                    fill={getElementColor(point.el, isDark)}
                    fontSize={isCarbon ? 12 : 9}
                    fontWeight={isCarbon ? 'bold' : '500'}
                  >
                    {point.el.modernSymbol}
                  </text>
                )}

                {/* Russell name for hypothetical elements (no symbol) */}
                {!point.el.modernSymbol && (
                  <text
                    x={point.x}
                    y={point.y - r - 4}
                    textAnchor="middle"
                    fill={getElementColor(point.el, isDark)}
                    fontSize={7}
                    opacity={0.7}
                  >
                    {point.el.russellName.slice(0, 4)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Carbon peak label */}
          {points.map((point, i) => {
            if (point.el.modernSymbol !== 'C') return null
            return (
              <text
                key={`carbon-label-${i}`}
                x={point.x}
                y={point.y - CARBON_R - 16}
                textAnchor="middle"
                fill={RUSSELL_COLORS.carbon[isDark ? 'dark' : 'light']}
                fontSize={10}
                fontWeight="600"
              >
                {t('russellChart.carbonPeak')}
              </text>
            )
          })}

          {/* Generation / Radiation labels at top */}
          <text
            x={MARGIN.left + CHART_W * 0.25}
            y={MARGIN.top - 12}
            textAnchor="middle"
            fill={isDark ? '#f59e0b' : '#d97706'}
            fontSize={10}
            fontWeight="500"
            opacity={0.6}
          >
            {t('russellChart.generationSide')}
          </text>
          <text
            x={MARGIN.left + CHART_W * 0.75}
            y={MARGIN.top - 12}
            textAnchor="middle"
            fill={isDark ? '#60a5fa' : '#2563eb'}
            fontSize={10}
            fontWeight="500"
            opacity={0.6}
          >
            {t('russellChart.radiationSide')}
          </text>
        </svg>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
        {t('russellChart.waveDescription')}
      </p>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none z-50 px-3 py-2 rounded-lg shadow-lg text-sm max-w-xs"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
            color: isDark ? '#f3f4f6' : '#1f2937',
          }}
        >
          <div className="font-semibold">
            {hovered.el.modernName || hovered.el.russellName}
            {hovered.el.modernSymbol && ` (${hovered.el.modernSymbol})`}
          </div>
          <div className="text-xs opacity-75">
            {t('russellChart.octave')} {hovered.octave.number} —{' '}
            {hovered.el.side === 'generation'
              ? t('russellChart.generationSide')
              : hovered.el.side === 'radiation'
              ? t('russellChart.radiationSide')
              : t('russellChart.inertGasLabel')}
          </div>
          <div className="text-xs opacity-75">
            {t('russellChart.amplitude')}: {Math.round(hovered.amplitude * 100)}%
          </div>
          {hovered.el.Z && (
            <div className="text-xs opacity-75">Z = {hovered.el.Z}</div>
          )}
          {hovered.el.note && (
            <div className="text-xs mt-1 italic opacity-60">{t(hovered.el.note)}</div>
          )}
          {hovered.el.Z && (
            <div className="text-xs mt-1 text-blue-500 dark:text-blue-400">
              {t('russellChart.clickToViewDetails')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
