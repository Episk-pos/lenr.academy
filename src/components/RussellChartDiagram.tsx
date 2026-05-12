import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import {
  RUSSELL_OCTAVES,
  RUSSELL_COLORS,
  POSITION_LABELS,
  type RussellElement,
  type RussellOctave,
} from '../constants/russellElements'

interface RussellChartDiagramProps {
  onElementClick?: (Z: number) => void
}

// Layout constants
const CELL_W = 120
const CELL_H = 64
const COL_GAP = 8
const ROW_GAP = 16
const COLS = 9 // positions -4 to +4
const HEADER_H = 40
const OCTAVE_LABEL_W = 90
const LEFT_MARGIN = OCTAVE_LABEL_W + 12
const TOP_MARGIN = HEADER_H + 12
const SERPENTINE_CURVE_W = 40

function getElementColor(
  el: RussellElement,
  isDark: boolean,
  variant: 'bg' | 'text' | 'border'
) {
  const mode = isDark ? 'dark' : 'light'
  const bgMode = isDark ? 'dark' : 'light'

  // Carbon gets special gold treatment
  if (el.modernSymbol === 'C') {
    if (variant === 'bg') return RUSSELL_COLORS.carbon.bg[bgMode]
    if (variant === 'border') return RUSSELL_COLORS.carbon[mode]
    return RUSSELL_COLORS.carbon[mode]
  }

  if (el.status === 'hypothetical') {
    if (variant === 'bg') return RUSSELL_COLORS.hypothetical.bg[bgMode]
    if (variant === 'border') return RUSSELL_COLORS.hypothetical[mode]
    return RUSSELL_COLORS.hypothetical[mode]
  }

  if (el.status === 'predicted') {
    if (variant === 'bg') return RUSSELL_COLORS.predicted.bg[bgMode]
    if (variant === 'border') return RUSSELL_COLORS.predicted[mode]
    return RUSSELL_COLORS.predicted[mode]
  }

  if (el.side === 'inertGas') {
    if (variant === 'bg') return RUSSELL_COLORS.inertGas.bg[bgMode]
    if (variant === 'border') return RUSSELL_COLORS.inertGas[mode]
    return RUSSELL_COLORS.inertGas[mode]
  }

  if (el.side === 'generation') {
    if (variant === 'bg') return RUSSELL_COLORS.generation.bg[bgMode]
    if (variant === 'border') return RUSSELL_COLORS.generation[mode]
    return RUSSELL_COLORS.generation[mode]
  }

  // radiation
  if (variant === 'bg') return RUSSELL_COLORS.radiation.bg[bgMode]
  if (variant === 'border') return RUSSELL_COLORS.radiation[mode]
  return RUSSELL_COLORS.radiation[mode]
}

/** Map position (-4..+4) to column index (0..8) */
function positionToCol(position: number): number {
  return position + 4
}

/** For serpentine: odd octave rows go left-to-right, even rows right-to-left */
function getVisualCol(col: number, octaveIndex: number): number {
  const isReversed = octaveIndex % 2 === 1
  return isReversed ? (COLS - 1 - col) : col
}

export default function RussellChartDiagram({ onElementClick }: RussellChartDiagramProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [hovered, setHovered] = useState<{ el: RussellElement; octave: RussellOctave } | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const totalRows = RUSSELL_OCTAVES.length
  const svgWidth = LEFT_MARGIN + COLS * (CELL_W + COL_GAP) + SERPENTINE_CURVE_W + 20
  const svgHeight = TOP_MARGIN + totalRows * (CELL_H + ROW_GAP) + 20

  // Build serpentine connector paths between row ends
  const serpentinePaths = useMemo(() => {
    const paths: string[] = []
    for (let i = 0; i < totalRows - 1; i++) {
      const y1 = TOP_MARGIN + i * (CELL_H + ROW_GAP) + CELL_H / 2
      const y2 = TOP_MARGIN + (i + 1) * (CELL_H + ROW_GAP) + CELL_H / 2
      const midY = (y1 + y2) / 2

      const isCurrentReversed = i % 2 === 1
      // Current row ends on the right if normal (L->R), on the left if reversed (R->L)
      // Next row starts on the same side as current ends
      if (!isCurrentReversed) {
        // Current row goes L->R, ends on right side
        const x = LEFT_MARGIN + (COLS - 1) * (CELL_W + COL_GAP) + CELL_W
        const xCurve = x + SERPENTINE_CURVE_W / 2
        paths.push(`M ${x} ${y1} C ${xCurve} ${y1}, ${xCurve} ${y2}, ${x} ${y2}`)
      } else {
        // Current row goes R->L, ends on left side
        const x = LEFT_MARGIN
        const xCurve = x - SERPENTINE_CURVE_W / 2
        paths.push(`M ${x} ${y1} C ${xCurve} ${midY}, ${xCurve} ${midY}, ${x} ${y2}`)
      }
    }
    return paths
  }, [totalRows])

  const handleMouseEnter = useCallback(
    (el: RussellElement, octave: RussellOctave, e: React.MouseEvent) => {
      setHovered({ el, octave })
      const rect = (e.currentTarget as SVGElement)
        .closest('.russell-chart-container')
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

  const textColor = isDark ? '#d1d5db' : '#374151'
  const subtleTextColor = isDark ? '#6b7280' : '#9ca3af'
  const headerBg = isDark ? '#1f2937' : '#f9fafb'
  const serpentineColor = isDark ? 'rgba(107, 114, 128, 0.3)' : 'rgba(156, 163, 175, 0.4)'

  // Background gradient zones for generation / radiation labels
  const genZoneWidth = 4 * (CELL_W + COL_GAP)
  const radZoneWidth = 4 * (CELL_W + COL_GAP)

  return (
    <div className="russell-chart-container relative">
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="select-none"
        >
                {/* Background zone labels */}
                <text
                  x={LEFT_MARGIN + genZoneWidth / 2 - CELL_W / 2}
                  y={16}
                  textAnchor="middle"
                  fill={isDark ? '#f59e0b' : '#d97706'}
                  fontSize={12}
                  fontWeight="600"
                  opacity={0.6}
                >
                  {t('russellChart.generationSide')}
                </text>
                <text
                  x={LEFT_MARGIN + 4 * (CELL_W + COL_GAP) + CELL_W / 2 + radZoneWidth / 2}
                  y={16}
                  textAnchor="middle"
                  fill={isDark ? '#60a5fa' : '#2563eb'}
                  fontSize={12}
                  fontWeight="600"
                  opacity={0.6}
                >
                  {t('russellChart.radiationSide')}
                </text>

                {/* Column headers */}
                {POSITION_LABELS.map((label, col) => {
                  const x = LEFT_MARGIN + col * (CELL_W + COL_GAP) + CELL_W / 2
                  return (
                    <g key={`header-${col}`}>
                      <rect
                        x={LEFT_MARGIN + col * (CELL_W + COL_GAP)}
                        y={TOP_MARGIN - HEADER_H + 4}
                        width={CELL_W}
                        height={HEADER_H - 8}
                        rx={4}
                        fill={headerBg}
                        opacity={0.6}
                      />
                      <text
                        x={x}
                        y={TOP_MARGIN - HEADER_H / 2 + 4}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={textColor}
                        fontSize={11}
                        fontWeight="500"
                      >
                        {label}
                      </text>
                    </g>
                  )
                })}

                {/* Serpentine connecting curves */}
                {serpentinePaths.map((d, i) => (
                  <path
                    key={`serpentine-${i}`}
                    d={d}
                    fill="none"
                    stroke={serpentineColor}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                  />
                ))}

                {/* Octave rows */}
                {RUSSELL_OCTAVES.map((octave, octaveIndex) => {
                  const rowY = TOP_MARGIN + octaveIndex * (CELL_H + ROW_GAP)

                  return (
                    <g key={`octave-${octave.number}`}>
                      {/* Octave label */}
                      <text
                        x={LEFT_MARGIN - 16}
                        y={rowY + CELL_H / 2}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill={textColor}
                        fontSize={12}
                        fontWeight="600"
                      >
                        {octave.number}
                      </text>
                      <text
                        x={LEFT_MARGIN - 16}
                        y={rowY + CELL_H / 2 + 14}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill={subtleTextColor}
                        fontSize={9}
                      >
                        {octave.inertGasName}
                      </text>

                      {/* Direction arrow indicator */}
                      {octave.elements.length > 1 && (
                        <text
                          x={LEFT_MARGIN - 16}
                          y={rowY + CELL_H / 2 - 14}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fill={subtleTextColor}
                          fontSize={10}
                        >
                          {octaveIndex % 2 === 0 ? '\u2192' : '\u2190'}
                        </text>
                      )}

                      {/* Element cells */}
                      {octave.elements.map((el) => {
                        const col = positionToCol(el.position)
                        const visualCol = getVisualCol(col, octaveIndex)
                        const x = LEFT_MARGIN + visualCol * (CELL_W + COL_GAP)
                        const y = rowY

                        const bgColor = getElementColor(el, isDark, 'bg')
                        const borderColor = getElementColor(el, isDark, 'border')
                        const elTextColor = getElementColor(el, isDark, 'text')
                        const isClickable = !!el.Z
                        const isHypothetical = el.status === 'hypothetical'
                        const isPredicted = el.status === 'predicted'
                        const isCarbon = el.modernSymbol === 'C'

                        return (
                          <g
                            key={`${octave.number}-${el.russellName}`}
                            className={isClickable ? 'cursor-pointer' : 'cursor-default'}
                            onMouseEnter={(e) => handleMouseEnter(el, octave, e)}
                            onMouseLeave={handleMouseLeave}
                            onClick={() => handleClick(el)}
                          >
                            {/* Cell background */}
                            <rect
                              x={x}
                              y={y}
                              width={CELL_W}
                              height={CELL_H}
                              rx={6}
                              fill={bgColor}
                              stroke={borderColor}
                              strokeWidth={isCarbon ? 2.5 : 1.5}
                              strokeDasharray={isHypothetical ? '4 3' : undefined}
                              opacity={isHypothetical ? 0.7 : 1}
                            />

                            {/* Carbon glow */}
                            {isCarbon && (
                              <rect
                                x={x - 2}
                                y={y - 2}
                                width={CELL_W + 4}
                                height={CELL_H + 4}
                                rx={8}
                                fill="none"
                                stroke={RUSSELL_COLORS.carbon[isDark ? 'dark' : 'light']}
                                strokeWidth={1}
                                opacity={0.4}
                              />
                            )}

                            {/* Predicted star marker */}
                            {isPredicted && (
                              <text
                                x={x + CELL_W - 12}
                                y={y + 14}
                                textAnchor="middle"
                                fill={RUSSELL_COLORS.predicted[isDark ? 'dark' : 'light']}
                                fontSize={14}
                                fontWeight="bold"
                              >
                                ★
                              </text>
                            )}

                            {/* Modern symbol (large) */}
                            <text
                              x={x + CELL_W / 2}
                              y={y + (el.modernSymbol ? 26 : 30)}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill={elTextColor}
                              fontSize={el.modernSymbol ? 18 : 13}
                              fontWeight="bold"
                            >
                              {el.modernSymbol || el.russellName}
                            </text>

                            {/* Russell name (below symbol) */}
                            {el.modernSymbol && (
                              <text
                                x={x + CELL_W / 2}
                                y={y + 44}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={elTextColor}
                                fontSize={9}
                                opacity={0.8}
                              >
                                {el.russellName}
                              </text>
                            )}

                            {/* Atomic number Z (top-left) */}
                            {el.Z && (
                              <text
                                x={x + 8}
                                y={y + 14}
                                textAnchor="start"
                                fill={elTextColor}
                                fontSize={9}
                                opacity={0.7}
                              >
                                {el.Z}
                              </text>
                            )}

                            {/* Position label (bottom-right) */}
                            <text
                              x={x + CELL_W - 8}
                              y={y + CELL_H - 8}
                              textAnchor="end"
                              fill={elTextColor}
                              fontSize={8}
                              opacity={0.5}
                            >
                              {el.position > 0 ? `+${el.position}` : el.position}
                            </text>
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
              </svg>
      </div>

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
