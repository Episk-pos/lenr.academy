import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'

type StabilityCategory = 'stable' | 'long' | 'short' | 'unknown'

export interface ChartNuclide {
  Z: number
  N: number
  A: number
  E: string
  stability: StabilityCategory
  logHalfLife?: number
}

interface SegreChartDiagramProps {
  nuclides: ChartNuclide[]
  onNuclideClick?: (nuclide: ChartNuclide) => void
}

const MAGIC_NUMBERS = [2, 8, 20, 28, 50, 82, 126]
const CELL_SIZE = 6
const AXIS_MARGIN = 40
const LABEL_INTERVAL = 10

function getStabilityColor(stability: StabilityCategory, isDark: boolean): string {
  switch (stability) {
    case 'stable': return isDark ? '#22c55e' : '#16a34a'
    case 'long': return isDark ? '#f97316' : '#ea580c'
    case 'short': return isDark ? '#ef4444' : '#dc2626'
    case 'unknown': return isDark ? '#6b7280' : '#9ca3af'
  }
}

function valleyOfStabilityN(Z: number): number {
  return Z + 0.006 * Z * Z
}

export default function SegreChartDiagram({ nuclides, onNuclideClick }: SegreChartDiagramProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [hovered, setHovered] = useState<ChartNuclide | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const { maxZ, maxN, svgWidth, svgHeight } = useMemo(() => {
    let mZ = 0, mN = 0
    for (const n of nuclides) {
      if (n.Z > mZ) mZ = n.Z
      if (n.N > mN) mN = n.N
    }
    return {
      maxZ: mZ,
      maxN: mN,
      svgWidth: AXIS_MARGIN + (mZ + 1) * CELL_SIZE + 10,
      svgHeight: AXIS_MARGIN + (mN + 1) * CELL_SIZE + 10,
    }
  }, [nuclides])

  const valleyPoints = useMemo(() => {
    const points: string[] = []
    for (let z = 1; z <= maxZ; z++) {
      const n = valleyOfStabilityN(z)
      if (n <= maxN) {
        const x = AXIS_MARGIN + z * CELL_SIZE + CELL_SIZE / 2
        const y = svgHeight - AXIS_MARGIN - n * CELL_SIZE - CELL_SIZE / 2
        points.push(`${x},${y}`)
      }
    }
    return points.join(' ')
  }, [maxZ, maxN, svgHeight])

  const handleMouseEnter = useCallback((nuclide: ChartNuclide, e: React.MouseEvent) => {
    setHovered(nuclide)
    const rect = (e.currentTarget as SVGElement).closest('.segre-chart-container')?.getBoundingClientRect()
    if (rect) {
      setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10 })
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(null)
  }, [])

  const handleClick = useCallback((nuclide: ChartNuclide) => {
    if (onNuclideClick) {
      onNuclideClick(nuclide)
    } else {
      navigate(`/element-data?Z=${nuclide.Z}&A=${nuclide.A}`)
    }
  }, [navigate, onNuclideClick])

  const textColor = isDark ? '#9ca3af' : '#6b7280'
  const magicLineColor = isDark ? 'rgba(147, 197, 253, 0.3)' : 'rgba(59, 130, 246, 0.25)'
  const valleyColor = isDark ? 'rgba(250, 204, 21, 0.5)' : 'rgba(202, 138, 4, 0.5)'

  return (
    <div className="segre-chart-container relative">
      <TransformWrapper
        initialScale={1}
        minScale={0.2}
        maxScale={15}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ mode: 'zoomIn' }}
        panning={{ velocityDisabled: false }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="flex gap-1 mb-2">
              <button onClick={() => zoomIn()} className="btn btn-secondary p-1.5" title={t('segreChart.zoomIn')}>
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => zoomOut()} className="btn btn-secondary p-1.5" title={t('segreChart.zoomOut')}>
                <ZoomOut className="w-4 h-4" />
              </button>
              <button onClick={() => resetTransform()} className="btn btn-secondary p-1.5" title={t('segreChart.resetZoom')}>
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <TransformComponent wrapperStyle={{ width: '100%', height: '600px', overflow: 'hidden' }}>
              <svg
                width={svgWidth}
                height={svgHeight}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="select-none"
              >
                {/* Magic number lines */}
                {MAGIC_NUMBERS.map(num => (
                  <g key={`magic-${num}`}>
                    {/* Vertical line at Z = num */}
                    {num <= maxZ && (
                      <>
                        <line
                          x1={AXIS_MARGIN + num * CELL_SIZE + CELL_SIZE / 2}
                          y1={0}
                          x2={AXIS_MARGIN + num * CELL_SIZE + CELL_SIZE / 2}
                          y2={svgHeight - AXIS_MARGIN}
                          stroke={magicLineColor}
                          strokeWidth={1}
                          strokeDasharray="4 2"
                        />
                        <text
                          x={AXIS_MARGIN + num * CELL_SIZE + CELL_SIZE / 2}
                          y={svgHeight - AXIS_MARGIN + 12}
                          textAnchor="middle"
                          fill={isDark ? 'rgba(147, 197, 253, 0.6)' : 'rgba(59, 130, 246, 0.6)'}
                          fontSize={8}
                          fontWeight="bold"
                        >
                          {num}
                        </text>
                      </>
                    )}
                    {/* Horizontal line at N = num */}
                    {num <= maxN && (
                      <>
                        <line
                          x1={AXIS_MARGIN}
                          y1={svgHeight - AXIS_MARGIN - num * CELL_SIZE - CELL_SIZE / 2}
                          x2={svgWidth}
                          y2={svgHeight - AXIS_MARGIN - num * CELL_SIZE - CELL_SIZE / 2}
                          stroke={magicLineColor}
                          strokeWidth={1}
                          strokeDasharray="4 2"
                        />
                        <text
                          x={AXIS_MARGIN - 4}
                          y={svgHeight - AXIS_MARGIN - num * CELL_SIZE - CELL_SIZE / 2 + 3}
                          textAnchor="end"
                          fill={isDark ? 'rgba(147, 197, 253, 0.6)' : 'rgba(59, 130, 246, 0.6)'}
                          fontSize={8}
                          fontWeight="bold"
                        >
                          {num}
                        </text>
                      </>
                    )}
                  </g>
                ))}

                {/* Valley of stability */}
                <polyline
                  points={valleyPoints}
                  fill="none"
                  stroke={valleyColor}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                />

                {/* Nuclide cells */}
                {nuclides.map(nuclide => {
                  const x = AXIS_MARGIN + nuclide.Z * CELL_SIZE
                  const y = svgHeight - AXIS_MARGIN - (nuclide.N + 1) * CELL_SIZE
                  return (
                    <rect
                      key={`${nuclide.Z}-${nuclide.A}`}
                      x={x}
                      y={y}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      fill={getStabilityColor(nuclide.stability, isDark)}
                      stroke={isDark ? '#1f2937' : '#ffffff'}
                      strokeWidth={0.5}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnter(nuclide, e)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleClick(nuclide)}
                    />
                  )
                })}

                {/* Axis labels */}
                {Array.from({ length: Math.floor(maxZ / LABEL_INTERVAL) + 1 }, (_, i) => i * LABEL_INTERVAL).filter(z => z > 0 && z <= maxZ).map(z => (
                  <text
                    key={`z-${z}`}
                    x={AXIS_MARGIN + z * CELL_SIZE + CELL_SIZE / 2}
                    y={svgHeight - AXIS_MARGIN + 22}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={9}
                  >
                    {z}
                  </text>
                ))}
                {Array.from({ length: Math.floor(maxN / LABEL_INTERVAL) + 1 }, (_, i) => i * LABEL_INTERVAL).filter(n => n > 0 && n <= maxN).map(n => (
                  <text
                    key={`n-${n}`}
                    x={AXIS_MARGIN - 6}
                    y={svgHeight - AXIS_MARGIN - n * CELL_SIZE - CELL_SIZE / 2 + 3}
                    textAnchor="end"
                    fill={textColor}
                    fontSize={9}
                  >
                    {n}
                  </text>
                ))}

                {/* Axis titles */}
                <text
                  x={svgWidth / 2}
                  y={svgHeight - 4}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize={11}
                  fontWeight="500"
                >
                  {t('segreChart.protonNumberAxis')}
                </text>
                <text
                  x={12}
                  y={svgHeight / 2 - AXIS_MARGIN / 2}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize={11}
                  fontWeight="500"
                  transform={`rotate(-90, 12, ${svgHeight / 2 - AXIS_MARGIN / 2})`}
                >
                  {t('segreChart.neutronNumberAxis')}
                </text>
              </svg>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none z-50 px-3 py-2 rounded-lg shadow-lg text-sm"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            border: `1px solid ${isDark ? '#4b5563' : '#e5e7eb'}`,
            color: isDark ? '#f3f4f6' : '#1f2937',
          }}
        >
          <div className="font-semibold">{hovered.E}-{hovered.A}</div>
          <div className="text-xs opacity-75">Z={hovered.Z}, N={hovered.N}</div>
          <div className="text-xs opacity-75">
            {hovered.stability === 'stable' ? t('segreChart.stable') :
             hovered.stability === 'long' ? t('segreChart.longHalfLife') :
             hovered.stability === 'short' ? t('segreChart.shortHalfLife') : t('segreChart.unknown')}
          </div>
          {hovered.logHalfLife !== undefined && hovered.logHalfLife !== null && hovered.stability !== 'stable' && (
            <div className="text-xs opacity-75">
              log(t½) = {hovered.logHalfLife.toFixed(2)} {t('segreChart.years')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
