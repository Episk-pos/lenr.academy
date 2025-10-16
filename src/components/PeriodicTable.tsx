import { Radiation } from 'lucide-react'
import type { Element, HeatmapMode } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { hasOnlyRadioactiveIsotopes } from '../services/queryService'
import { SPECIAL_PARTICLES } from '../constants/specialParticles'
import { useTheme } from '../contexts/ThemeContext'

interface PeriodicTableProps {
  availableElements: Element[]
  selectedElement: string | null
  onElementClick: (symbol: string) => void
  selectedParticle?: string | null
  onParticleClick?: (particleId: string) => void
  // Heatmap props
  heatmapData?: Map<string, number>
  heatmapMode?: HeatmapMode
  showHeatmap?: boolean
}

const HYDROGEN_ISOTOPES = [
  { symbol: 'D', label: 'Deuterium (2H)' },
  { symbol: 'T', label: 'Tritium (3H)' }
]

const ISOTOPE_BUTTON_COMMON = 'grid place-items-center rounded border border-dashed text-xs font-semibold leading-none px-1.5 py-1 transition-all duration-150 min-w-[2rem] min-h-[2rem]';

// Standard periodic table layout (Period, Group) for each element by atomic number
const ELEMENT_POSITIONS: Record<number, { period: number; group: number }> = {
  1: { period: 1, group: 1 },   // H
  2: { period: 1, group: 18 },  // He
  3: { period: 2, group: 1 },   // Li
  4: { period: 2, group: 2 },   // Be
  5: { period: 2, group: 13 },  // B
  6: { period: 2, group: 14 },  // C
  7: { period: 2, group: 15 },  // N
  8: { period: 2, group: 16 },  // O
  9: { period: 2, group: 17 },  // F
  10: { period: 2, group: 18 }, // Ne
  11: { period: 3, group: 1 },  // Na
  12: { period: 3, group: 2 },  // Mg
  13: { period: 3, group: 13 }, // Al
  14: { period: 3, group: 14 }, // Si
  15: { period: 3, group: 15 }, // P
  16: { period: 3, group: 16 }, // S
  17: { period: 3, group: 17 }, // Cl
  18: { period: 3, group: 18 }, // Ar
  19: { period: 4, group: 1 },  // K
  20: { period: 4, group: 2 },  // Ca
  21: { period: 4, group: 3 },  // Sc
  22: { period: 4, group: 4 },  // Ti
  23: { period: 4, group: 5 },  // V
  24: { period: 4, group: 6 },  // Cr
  25: { period: 4, group: 7 },  // Mn
  26: { period: 4, group: 8 },  // Fe
  27: { period: 4, group: 9 },  // Co
  28: { period: 4, group: 10 }, // Ni
  29: { period: 4, group: 11 }, // Cu
  30: { period: 4, group: 12 }, // Zn
  31: { period: 4, group: 13 }, // Ga
  32: { period: 4, group: 14 }, // Ge
  33: { period: 4, group: 15 }, // As
  34: { period: 4, group: 16 }, // Se
  35: { period: 4, group: 17 }, // Br
  36: { period: 4, group: 18 }, // Kr
  37: { period: 5, group: 1 },  // Rb
  38: { period: 5, group: 2 },  // Sr
  39: { period: 5, group: 3 },  // Y
  40: { period: 5, group: 4 },  // Zr
  41: { period: 5, group: 5 },  // Nb
  42: { period: 5, group: 6 },  // Mo
  43: { period: 5, group: 7 },  // Tc
  44: { period: 5, group: 8 },  // Ru
  45: { period: 5, group: 9 },  // Rh
  46: { period: 5, group: 10 }, // Pd
  47: { period: 5, group: 11 }, // Ag
  48: { period: 5, group: 12 }, // Cd
  49: { period: 5, group: 13 }, // In
  50: { period: 5, group: 14 }, // Sn
  51: { period: 5, group: 15 }, // Sb
  52: { period: 5, group: 16 }, // Te
  53: { period: 5, group: 17 }, // I
  54: { period: 5, group: 18 }, // Xe
  55: { period: 6, group: 1 },  // Cs
  56: { period: 6, group: 2 },  // Ba
  57: { period: 6, group: 3 },  // La
  58: { period: 8, group: 4 },  // Ce
  59: { period: 8, group: 5 },  // Pr
  60: { period: 8, group: 6 },  // Nd
  61: { period: 8, group: 7 },  // Pm
  62: { period: 8, group: 8 },  // Sm
  63: { period: 8, group: 9 },  // Eu
  64: { period: 8, group: 10 }, // Gd
  65: { period: 8, group: 11 }, // Tb
  66: { period: 8, group: 12 }, // Dy
  67: { period: 8, group: 13 }, // Ho
  68: { period: 8, group: 14 }, // Er
  69: { period: 8, group: 15 }, // Tm
  70: { period: 8, group: 16 }, // Yb
  71: { period: 8, group: 17 }, // Lu
  72: { period: 6, group: 4 },  // Hf
  73: { period: 6, group: 5 },  // Ta
  74: { period: 6, group: 6 },  // W
  75: { period: 6, group: 7 },  // Re
  76: { period: 6, group: 8 },  // Os
  77: { period: 6, group: 9 },  // Ir
  78: { period: 6, group: 10 }, // Pt
  79: { period: 6, group: 11 }, // Au
  80: { period: 6, group: 12 }, // Hg
  81: { period: 6, group: 13 }, // Tl
  82: { period: 6, group: 14 }, // Pb
  83: { period: 6, group: 15 }, // Bi
  84: { period: 6, group: 16 }, // Po
  85: { period: 6, group: 17 }, // At
  86: { period: 6, group: 18 }, // Rn
  87: { period: 7, group: 1 },  // Fr
  88: { period: 7, group: 2 },  // Ra
  89: { period: 7, group: 3 },  // Ac
  90: { period: 9, group: 4 },  // Th
  91: { period: 9, group: 5 },  // Pa
  92: { period: 9, group: 6 },  // U
  93: { period: 9, group: 7 },  // Np
  94: { period: 9, group: 8 },  // Pu
  95: { period: 9, group: 9 },  // Am
  96: { period: 9, group: 10 }, // Cm
  97: { period: 9, group: 11 }, // Bk
  98: { period: 9, group: 12 }, // Cf
  99: { period: 9, group: 13 }, // Es
  100: { period: 9, group: 14 }, // Fm
  101: { period: 9, group: 15 }, // Md
  102: { period: 9, group: 16 }, // No
  103: { period: 9, group: 17 }, // Lr
  104: { period: 7, group: 4 },  // Rf
  105: { period: 7, group: 5 },  // Db
  106: { period: 7, group: 6 },  // Sg
  107: { period: 7, group: 7 },  // Bh
  108: { period: 7, group: 8 },  // Hs
  109: { period: 7, group: 9 },  // Mt
  110: { period: 7, group: 10 }, // Ds
  111: { period: 7, group: 11 }, // Rg
  112: { period: 7, group: 12 }, // Cn
  113: { period: 7, group: 13 }, // Nh
  114: { period: 7, group: 14 }, // Fl
  115: { period: 7, group: 15 }, // Mc
  116: { period: 7, group: 16 }, // Lv
  117: { period: 7, group: 17 }, // Ts
  118: { period: 7, group: 18 }  // Og
}

const ALL_ELEMENT_NAMES: Record<number, string> = {
  1: 'H', 2: 'He', 3: 'Li', 4: 'Be', 5: 'B', 6: 'C', 7: 'N', 8: 'O', 9: 'F', 10: 'Ne',
  11: 'Na', 12: 'Mg', 13: 'Al', 14: 'Si', 15: 'P', 16: 'S', 17: 'Cl', 18: 'Ar', 19: 'K', 20: 'Ca',
  21: 'Sc', 22: 'Ti', 23: 'V', 24: 'Cr', 25: 'Mn', 26: 'Fe', 27: 'Co', 28: 'Ni', 29: 'Cu', 30: 'Zn',
  31: 'Ga', 32: 'Ge', 33: 'As', 34: 'Se', 35: 'Br', 36: 'Kr', 37: 'Rb', 38: 'Sr', 39: 'Y', 40: 'Zr',
  41: 'Nb', 42: 'Mo', 43: 'Tc', 44: 'Ru', 45: 'Rh', 46: 'Pd', 47: 'Ag', 48: 'Cd', 49: 'In', 50: 'Sn',
  51: 'Sb', 52: 'Te', 53: 'I', 54: 'Xe', 55: 'Cs', 56: 'Ba', 57: 'La', 58: 'Ce', 59: 'Pr', 60: 'Nd',
  61: 'Pm', 62: 'Sm', 63: 'Eu', 64: 'Gd', 65: 'Tb', 66: 'Dy', 67: 'Ho', 68: 'Er', 69: 'Tm', 70: 'Yb',
  71: 'Lu', 72: 'Hf', 73: 'Ta', 74: 'W', 75: 'Re', 76: 'Os', 77: 'Ir', 78: 'Pt', 79: 'Au', 80: 'Hg',
  81: 'Tl', 82: 'Pb', 83: 'Bi', 84: 'Po', 85: 'At', 86: 'Rn', 87: 'Fr', 88: 'Ra', 89: 'Ac', 90: 'Th',
  91: 'Pa', 92: 'U', 93: 'Np', 94: 'Pu', 95: 'Am', 96: 'Cm', 97: 'Bk', 98: 'Cf', 99: 'Es', 100: 'Fm',
  101: 'Md', 102: 'No', 103: 'Lr', 104: 'Rf', 105: 'Db', 106: 'Sg', 107: 'Bh', 108: 'Hs', 109: 'Mt', 110: 'Ds',
  111: 'Rg', 112: 'Cn', 113: 'Nh', 114: 'Fl', 115: 'Mc', 116: 'Lv', 117: 'Ts', 118: 'Og'
}

const SPECIAL_PARTICLES_BY_GROUP = SPECIAL_PARTICLES.reduce<Record<number, typeof SPECIAL_PARTICLES[number]>>((acc, particle) => {
  acc[particle.position.group] = particle
  return acc
}, {})

/**
 * Calculate heatmap background color for an element
 * Returns gradient colors from light → dark based on metric intensity
 * Uses continuous gradient with 32 levels for fine color differentiation
 */
function getHeatmapColor(
  symbol: string,
  heatmapData: Map<string, number> | undefined,
  showHeatmap: boolean,
  isDarkMode: boolean
): string {
  if (!showHeatmap || !heatmapData || !heatmapData.has(symbol)) {
    return 'transparent'
  }

  const value = heatmapData.get(symbol) || 0
  const maxValue = Math.max(...Array.from(heatmapData.values()))

  if (maxValue === 0) return 'transparent'

  // Calculate intensity (0-1 scale)
  const intensity = value / maxValue

  // 32-level gradient for very fine color differentiation
  // Light mode: blue gradient (light blue → deep blue)
  // Dark mode: green gradient (dim green → bright green)
  if (isDarkMode) {
    // Green gradient for dark mode with 32 distinct levels
    // Using HSL interpolation for smoother, more perceptible transitions
    // hsl(140, 60%, 20%) at 0 → hsl(140, 80%, 65%) at 1
    const hue = 140
    const saturation = 60 + (intensity * 20) // 60% → 80%
    const lightness = 20 + (intensity * 45)  // 20% → 65%
    const alpha = 0.3 + (intensity * 0.6)    // 0.3 → 0.9 for better visibility
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`
  } else {
    // Blue gradient for light mode with 32 distinct levels
    // Using RGB interpolation with exponential scaling for better perceptual uniformity
    // From light blue rgb(240, 245, 255) to deep blue rgb(20, 60, 180)
    const r = Math.round(240 - (intensity ** 0.8) * 220)
    const g = Math.round(245 - (intensity ** 0.8) * 185)
    const b = Math.round(255 - (intensity ** 0.8) * 75)
    return `rgb(${r}, ${g}, ${b})`
  }
}

/**
 * Get tooltip text for heatmap metric
 */
function getHeatmapTooltip(
  symbol: string,
  heatmapData: Map<string, number> | undefined,
  heatmapMode: HeatmapMode,
  baseTitle: string
): string {
  if (!heatmapData || !heatmapData.has(symbol)) {
    return baseTitle
  }

  const value = heatmapData.get(symbol) || 0
  let metricLabel = ''

  switch (heatmapMode) {
    case 'frequency':
      metricLabel = `${value} reactions`
      break
    case 'energy':
      metricLabel = `${value.toFixed(2)} MeV total`
      break
    case 'diversity':
      metricLabel = `${value} unique isotopes`
      break
  }

  return `${baseTitle}\n${metricLabel}`
}

export default function PeriodicTable({
  availableElements,
  selectedElement,
  onElementClick,
  selectedParticle = null,
  onParticleClick,
  heatmapData,
  heatmapMode = 'frequency',
  showHeatmap = false
}: PeriodicTableProps) {
  const { db } = useDatabase()
  const { theme } = useTheme()
  const isDarkMode = theme === 'dark'
  const availableSymbols = new Set(availableElements.map(el => el.E))

  if (availableSymbols.has('H')) {
    availableSymbols.add('D')
    availableSymbols.add('T')
  }

  // Organize elements by position
  const elementsByPosition: Record<string, { Z: number; symbol: string; isAvailable: boolean }> = {}

  Object.entries(ELEMENT_POSITIONS).forEach(([zStr, pos]) => {
    const Z = parseInt(zStr)
    const symbol = ALL_ELEMENT_NAMES[Z]
    const key = `${pos.period}-${pos.group}`

    elementsByPosition[key] = {
      Z,
      symbol,
      isAvailable: availableSymbols.has(symbol)
    }
  })

  const renderParticleButton = (particle: (typeof SPECIAL_PARTICLES)[number]) => {
    const isSelectedParticle = selectedParticle === particle.id

    return (
      <div className="flex flex-col items-center gap-1 pb-2">
        <button
          type="button"
          onClick={() => onParticleClick?.(particle.id)}
          className={`
            w-8 h-8 rounded-[10px] border border-dashed transition-all duration-150 flex items-center justify-center text-sm font-semibold
            ${isSelectedParticle
              ? 'bg-blue-500/20 border-blue-500 text-blue-900 dark:text-blue-100 shadow-md'
              : 'bg-white/80 dark:bg-gray-800/80 border-blue-200/70 dark:border-blue-900/60 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 hover:border-blue-400'}
            ${onParticleClick ? 'cursor-pointer' : 'cursor-default'}
          `}
        >
          {particle.displaySymbol}
        </button>
        <span className="text-[0.55rem] uppercase tracking-wide text-gray-500 dark:text-gray-400 leading-none text-center">
          {particle.name}
        </span>
      </div>
    )
  }

  const renderCell = (period: number, group: number) => {
    if (period === 2) {
      if (group === 3) {
        return (
          <div
            key={`particle-band-${period}`}
            className="h-full flex items-end"
            style={{ gridColumn: '3 / 13' }}
          >
            <div className="w-full grid grid-cols-10 gap-[2px] items-end">
              {Array.from({ length: 10 }, (_, idx) => {
                const groupNumber = idx + 3
                const particle = SPECIAL_PARTICLES_BY_GROUP[groupNumber]
                if (!particle) {
                  return <div key={groupNumber} />
                }
                return (
                  <div key={groupNumber} className="flex justify-center">
                    {renderParticleButton(particle)}
                  </div>
                )
              })}
            </div>
          </div>
        )
      }

      if (group > 3 && group < 13) {
        return null
      }
    }

    const key = `${period}-${group}`
    const cellData = elementsByPosition[key]

    if (!cellData) {
      return <div key={key} className="aspect-square" />
    }

    const isSelected = selectedElement === cellData.symbol
    const isAvailable = cellData.isAvailable
    const isPurelyRadioactive = db && isAvailable ? hasOnlyRadioactiveIsotopes(db, cellData.Z) : false
    const isHydrogenCell = cellData.symbol === 'H'

    // Get heatmap background color - show heatmap for ALL elements with data, not just available ones
    const heatmapBgColor = getHeatmapColor(cellData.symbol, heatmapData, showHeatmap, isDarkMode)
    const hasHeatmap = heatmapBgColor !== 'transparent'

    const buttonClassName = `
      aspect-square relative
      flex flex-col items-center justify-center font-medium rounded border
      transition-all duration-150
      ${isSelected
        ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-400 shadow-md'
        : isAvailable
          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 cursor-pointer'
          : hasHeatmap
            ? 'text-gray-900 dark:text-gray-100 border-gray-400 dark:border-gray-500 cursor-not-allowed'
            : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
      }
    `

    const buttonTitle = isAvailable
      ? getHeatmapTooltip(
          cellData.symbol,
          heatmapData,
          heatmapMode,
          isPurelyRadioactive
            ? `${cellData.symbol} (Z=${cellData.Z}) - No stable isotopes`
            : `${cellData.symbol} (Z=${cellData.Z})`
        )
      : `${cellData.symbol} - Not available`

    const buttonContent = (
      <>
        {isPurelyRadioactive && (
          <span className="absolute top-0 right-0 p-0.5">
            <Radiation className={`w-2 h-2 ${isSelected ? 'text-red-200' : 'text-red-600 dark:text-red-400'}`} />
          </span>
        )}
        <div className="text-[9px] leading-none">{cellData.Z}</div>
        <div className="font-bold text-xs leading-none">{cellData.symbol}</div>
      </>
    )

    if (!isHydrogenCell) {
      return (
        <button
          key={key}
          onClick={() => isAvailable && onElementClick(cellData.symbol)}
          disabled={!isAvailable}
          className={buttonClassName}
          title={buttonTitle}
          style={!isSelected && hasHeatmap ? { backgroundColor: heatmapBgColor, borderColor: hasHeatmap && !isAvailable ? 'rgb(156, 163, 175)' : undefined } : undefined}
        >
          {buttonContent}
        </button>
      )
    }

    return (
      <div key={key} className="relative inline-flex">
        <button
          onClick={() => isAvailable && onElementClick(cellData.symbol)}
          disabled={!isAvailable}
          className={buttonClassName}
          title={buttonTitle}
          style={!isSelected && hasHeatmap ? { backgroundColor: heatmapBgColor, borderColor: hasHeatmap && !isAvailable ? 'rgb(156, 163, 175)' : undefined } : undefined}
        >
          {buttonContent}
        </button>
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 flex items-center gap-1">
          {HYDROGEN_ISOTOPES.map(isotope => {
            const isotopeAvailable = availableSymbols.has(isotope.symbol)
            const isotopeSelected = selectedElement === isotope.symbol

            // Get heatmap colors for hydrogen isotopes
            const isotopeBgColor = getHeatmapColor(isotope.symbol, heatmapData, showHeatmap, isDarkMode)
            const isotopeHasHeatmap = isotopeBgColor !== 'transparent'

            const isotopeTooltip = isotopeAvailable
              ? getHeatmapTooltip(isotope.symbol, heatmapData, heatmapMode, `${isotope.label} - hydrogen isotope`)
              : `${isotope.label} - hydrogen isotope`

            return (
              <button
                key={isotope.symbol}
                onClick={() => isotopeAvailable && onElementClick(isotope.symbol)}
                disabled={!isotopeAvailable}
                className={`
                  ${ISOTOPE_BUTTON_COMMON}
                  ${isotopeSelected
                    ? 'bg-blue-500 text-white border-blue-600 ring-1 ring-blue-300 shadow'
                    : isotopeAvailable
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 cursor-pointer'
                      : 'bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-gray-800 cursor-not-allowed'
                  }
                `}
                title={isotopeTooltip}
                style={!isotopeSelected && isotopeHasHeatmap ? { backgroundColor: isotopeBgColor } : undefined}
              >
                {isotope.symbol}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-3 sm:p-6 overflow-x-auto">
      <div className="flex justify-start sm:justify-center">
        <div className="inline-block pr-3 sm:pr-6">
        {/* Main periodic table grid (periods 1-7) */}
        <div className="grid gap-0.5 sm:gap-1 mb-1 sm:mb-2" style={{ gridTemplateColumns: 'repeat(18, minmax(1.75rem, 3rem))' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(period => (
            Array.from({ length: 18 }, (_, i) => {
              const group = i + 1
              return renderCell(period, group)
            })
          ))}
        </div>

        {/* Lanthanides (period 8) */}
        <div className="grid gap-0.5 sm:gap-1 mb-1 sm:mb-2 ml-[5.625rem] sm:ml-[9.75rem]" style={{ gridTemplateColumns: 'repeat(15, minmax(1.75rem, 3rem))' }}>
          {Array.from({ length: 15 }, (_, i) => renderCell(8, i + 4))}
        </div>

        {/* Actinides (period 9) */}
        <div className="grid gap-0.5 sm:gap-1 mb-3 ml-[5.625rem] sm:ml-[9.75rem]" style={{ gridTemplateColumns: 'repeat(15, minmax(1.75rem, 3rem))' }}>
          {Array.from({ length: 15 }, (_, i) => renderCell(9, i + 4))}
        </div>

        {/* Legend */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="font-semibold">Legend:</span>
              <Radiation className="w-3 h-3 text-red-600 dark:text-red-400" />
              <span>= No stable isotopes (half-life &lt; 10⁹ years)</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center justify-center rounded border border-dashed border-gray-300 dark:border-gray-600 px-1.5 py-1 text-xs font-semibold leading-none">D</span>
              <span className="inline-flex items-center justify-center rounded border border-dashed border-gray-300 dark:border-gray-600 px-1.5 py-1 text-xs font-semibold leading-none">T</span>
              <span>= Hydrogen isotopes (selectable)</span>
            </span>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
