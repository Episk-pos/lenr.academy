import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Radiation } from 'lucide-react'
import type { Element } from '../types'
import { useDatabase } from '../contexts/DatabaseContext'
import { hasOnlyRadioactiveIsotopes } from '../services/queryService'
import { SPECIAL_PARTICLES } from '../constants/specialParticles'

interface PeriodicTableSelectorProps {
  label: string
  availableElements: Element[]
  selectedElements: string[]
  onSelectionChange: (elements: string[]) => void
  maxSelections?: number
  align?: 'left' | 'center' | 'right'
}

const HYDROGEN_ISOTOPES = [
  { symbol: 'D', label: 'Deuterium (2H)' },
  { symbol: 'T', label: 'Tritium (3H)' }
]

const ISOTOPE_BUTTON_COMMON = 'periodic-cell-isotope-base';

const SPECIAL_PARTICLES_BY_GROUP = SPECIAL_PARTICLES.reduce<Record<number, typeof SPECIAL_PARTICLES[number]>>((acc, particle) => {
  acc[particle.position.group] = particle
  return acc
}, {})

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
  57: { period: 8, group: 3 },  // La (Lanthanide)
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
  89: { period: 9, group: 3 },  // Ac (Actinide)
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
  118: { period: 7, group: 18 }, // Og
}

export default function PeriodicTableSelector({
  label,
  availableElements,
  selectedElements,
  onSelectionChange,
  maxSelections,
  align = 'left',
}: PeriodicTableSelectorProps) {
  const { db } = useDatabase()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close dropdown when pressing Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const toggleElement = (symbol: string) => {
    if (selectedElements.includes(symbol)) {
      onSelectionChange(selectedElements.filter(e => e !== symbol))
    } else {
      if (maxSelections && selectedElements.length >= maxSelections) {
        return // Don't allow more selections
      }
      onSelectionChange([...selectedElements, symbol])
    }
  }

  const clearSelection = () => {
    onSelectionChange([])
  }

  // Create a set of available element symbols for quick lookup
  const availableSymbols = new Set(availableElements.map(el => el.E))
  if (availableSymbols.has('H')) {
    HYDROGEN_ISOTOPES.forEach(isotope => availableSymbols.add(isotope.symbol))
  }
  SPECIAL_PARTICLES.forEach(particle => availableSymbols.add(particle.id))

  // Create full element list with all 118 elements
const allElementNames: Record<number, string> = {
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

  const renderParticleButton = (particle: (typeof SPECIAL_PARTICLES)[number]) => {
    const isSelected = selectedElements.includes(particle.id)
    return (
      <div className="periodic-particle-cell">
        <button
          type="button"
          onClick={() => toggleElement(particle.id)}
          className={`
            periodic-particle-button
            ${isSelected
              ? 'periodic-particle-selected'
              : ''}
          `}
        >
          {particle.displaySymbol}
        </button>
        <span className="periodic-particle-label">
          {particle.name}
        </span>
      </div>
    )
  }

  // Organize elements by their position in the periodic table
  const elementsByPosition: Record<string, { element: Element | null; Z: number; symbol: string; isAvailable: boolean }> = {}

  // First populate with all elements
  Object.entries(ELEMENT_POSITIONS).forEach(([zStr, pos]) => {
    const Z = parseInt(zStr)
    const symbol = allElementNames[Z]
    const key = `${pos.period}-${pos.group}`
    const availableElement = availableElements.find(el => el.Z === Z)

    elementsByPosition[key] = {
      element: availableElement || null,
      Z,
      symbol,
      isAvailable: availableSymbols.has(symbol)
    }
  })

  // Render a single element cell
  const renderCell = (period: number, group: number) => {
    const key = `${period}-${group}`
    const cellData = elementsByPosition[key]

    if (!cellData) {
      return <div key={key} className="periodic-cell-empty" />
    }

    const { symbol, Z, isAvailable } = cellData
    const isSelected = selectedElements.includes(symbol)
    const isPurelyRadioactive = db && isAvailable ? hasOnlyRadioactiveIsotopes(db, Z) : false

    const buttonTitle = isAvailable
      ? isPurelyRadioactive
        ? `${cellData.element?.EName || symbol} (${Z}) - No stable isotopes`
        : `${cellData.element?.EName || symbol} (${Z})`
      : `${symbol} (${Z}) - Not available in database`

    const buttonChildren = (
      <>
        {isPurelyRadioactive && (
          <span className="periodic-cell-radiation">
            <Radiation className="periodic-cell-radiation-icon" />
          </span>
        )}
        <div className="periodic-cell-number">{Z}</div>
        <div className="periodic-cell-symbol">{symbol}</div>
      </>
    )

    if (symbol !== 'H') {
      return (
        <button
          key={key}
          onClick={() => isAvailable && toggleElement(symbol)}
          disabled={!isAvailable}
          className={`periodic-cell ${isSelected ? 'periodic-cell-selected' : ''} ${!isAvailable ? 'periodic-cell-disabled' : ''}`}
          title={buttonTitle}
        >
          {buttonChildren}
        </button>
      )
    }

    return (
      <div key={key} className="periodic-cell-wrapper">
        <button
          onClick={() => isAvailable && toggleElement(symbol)}
          disabled={!isAvailable}
          className={`periodic-cell ${isSelected ? 'periodic-cell-selected' : ''} ${!isAvailable ? 'periodic-cell-disabled' : ''}`}
          title={buttonTitle}
        >
          {buttonChildren}
        </button>
        <div className="periodic-cell-isotope-group">
          {HYDROGEN_ISOTOPES.map(isotope => {
            const isotopeAvailable = availableSymbols.has(isotope.symbol)
            const isotopeSelected = selectedElements.includes(isotope.symbol)
            return (
              <button
                key={isotope.symbol}
                onClick={() => isotopeAvailable && toggleElement(isotope.symbol)}
                disabled={!isotopeAvailable}
                className={`${ISOTOPE_BUTTON_COMMON} ${isotopeSelected ? 'periodic-cell-isotope-selected' : ''} ${!isotopeAvailable ? 'periodic-cell-isotope-disabled' : ''}`}
                title={`${isotope.label} - hydrogen isotope`}
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
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input flex items-center justify-between w-full"
      >
        <span className="text-sm">
          {selectedElements.length === 0
            ? 'Any'
            : `${selectedElements.length} selected: ${selectedElements.join(', ')}`}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Selected Elements Badges */}
      {selectedElements.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedElements.map(symbol => {
            const element = availableElements.find(e => e.E === symbol)
            const isotopeLabel = HYDROGEN_ISOTOPES.find(isotope => isotope.symbol === symbol)?.label
            const particleLabel = SPECIAL_PARTICLES.find(p => p.id === symbol)?.name
            return (
              <span
                key={symbol}
                className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded text-xs font-medium"
              >
                {symbol}
                {element && ` (${element.EName})`}
                {!element && isotopeLabel && ` (${isotopeLabel})`}
                {!element && !isotopeLabel && particleLabel && ` (${particleLabel})`}
                <button
                  type="button"
                  onClick={() => toggleElement(symbol)}
                  className="hover:text-primary-900 dark:hover:text-primary-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Periodic Table Dropdown */}
      {isOpen && (
        <div className={`
          fixed sm:absolute z-50
          inset-x-4 top-20 sm:inset-x-auto sm:top-auto sm:mt-2
          max-h-[calc(100vh-6rem)] sm:max-h-none overflow-y-auto sm:overflow-visible
          bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4
          w-auto sm:w-full sm:min-w-[650px] lg:min-w-[800px]
          ${align === 'right' ? 'sm:right-0' : align === 'center' ? 'sm:left-1/2 sm:-translate-x-1/2' : ''}
        `}>
          <div className="mb-3 flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">Select Elements</h3>
            {selectedElements.length > 0 && (
              <button
                onClick={clearSelection}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300"
              >
                Clear Selection
              </button>
            )}
          </div>

          {/* Main periodic table (periods 1-7, excluding lanthanides/actinides) */}
          <div className="relative mb-4">
            <div className="periodic-row">
              {[1, 2, 3, 4, 5, 6, 7].map(period =>
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(group => {
                  // Skip groups 3-12 for periods 1-3 (they don't have elements there)
                  if (period === 1 && group >= 3 && group <= 12) {
                    return <div key={`${period}-${group}`} className="periodic-cell-empty" />
                  }
                  if (period === 2 && group >= 3 && group <= 12) {
                    return <div key={`${period}-${group}`} className="periodic-cell-empty" />
                  }
                  if (period === 3 && group >= 3 && group <= 12) {
                    return <div key={`${period}-${group}`} className="periodic-cell-empty" />
                  }
                  // Skip lanthanide/actinide positions
                  if ((period === 6 || period === 7) && group === 3) {
                    return (
                      <div
                        key={`${period}-${group}`}
                        className="periodic-cell-placeholder text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center"
                      >
                        {period === 6 ? '57-71' : '89-103'}
                      </div>
                    )
                  }

                  return renderCell(period, group)
                })
              )}
            </div>

            {/* Particle overlay - positioned to appear in period 2, columns 3-12 */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: 'calc((28px + 2px) * 1 + 2px)', // After period 1 (min-height 28px from CSS) + gaps
                left: 'calc((28px + 2px) * 2 + 2px)', // After columns 1-2 + gaps
                width: 'calc((28px + 2px) * 10)', // Span 10 columns
                display: 'flex',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              {Array.from({ length: 10 }, (_, idx) => {
                const groupNumber = idx + 3
                const particle = SPECIAL_PARTICLES_BY_GROUP[groupNumber]
                if (!particle) {
                  return <div key={groupNumber} style={{ flex: 1 }} />
                }
                return (
                  <div key={groupNumber} style={{ flex: 1, display: 'flex', justifyContent: 'center' }} className="pointer-events-auto">
                    {renderParticleButton(particle)}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lanthanides */}
          <div className="mb-2">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Lanthanides (57-71)</div>
            <div className="periodic-row">
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(group =>
                renderCell(8, group)
              )}
            </div>
          </div>

          {/* Actinides */}
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-medium">Actinides (89-103)</div>
            <div className="periodic-row">
              {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(group =>
                renderCell(9, group)
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-4">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="font-semibold">Legend:</span>
                <Radiation className="w-3 h-3 text-red-600 dark:text-red-400" />
                <span>= No stable isotopes (half-life &lt; 10⁹ years)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className={`${ISOTOPE_BUTTON_COMMON} legend-swatch`}>D</span>
                <span className={`${ISOTOPE_BUTTON_COMMON} legend-swatch`}>T</span>
                <span>= Hydrogen isotopes</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .periodic-table-grid {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .periodic-cell-wrapper {
          position: relative;
          display: inline-flex;
        }

        .periodic-row {
          display: grid;
          grid-template-columns: repeat(18, 1fr);
          gap: 2px;
        }

        .periodic-particle-band {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          pointer-events: none;
        }

        .periodic-particle-grid {
          pointer-events: auto;
          width: 100%;
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          gap: 2px;
          align-items: end;
        }

        .periodic-particle-cell-wrapper {
          display: flex;
          justify-content: center;
          align-items: flex-end;
        }

        .periodic-particle-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .periodic-particle-button {
          width: 20px;
          height: 20px;
          border: 1px dashed rgba(59, 130, 246, 0.6);
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.8);
          color: rgba(59, 130, 246, 0.9);
          transition: all 0.15s ease;
          cursor: pointer;
        }

        @media (min-width: 640px) {
          .periodic-particle-button {
            width: 24px;
            height: 24px;
            border-radius: 8px;
            font-size: 0.75rem;
          }
        }

        @media (min-width: 1024px) {
          .periodic-particle-button {
            width: 28px;
            height: 28px;
            border-radius: 10px;
            font-size: 0.8rem;
          }
        }

        .dark .periodic-particle-button {
          background: rgba(55, 65, 81, 0.8);
          color: rgba(191, 219, 254, 0.9);
          border-color: rgba(96, 165, 250, 0.6);
        }

        .periodic-particle-button:hover {
          background: rgba(191, 219, 254, 0.6);
        }

        .dark .periodic-particle-button:hover {
          background: rgba(59, 130, 246, 0.25);
        }

        .periodic-particle-selected {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgb(59, 130, 246);
          color: rgb(30, 64, 175);
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.3);
        }

        .dark .periodic-particle-selected {
          background: rgba(59, 130, 246, 0.3);
          color: #bfdbfe;
          border-color: #60a5fa;
        }

        .periodic-particle-label {
          text-transform: uppercase;
          font-size: 0.5rem;
          color: #6b7280;
          text-align: center;
          line-height: 1;
        }

        @media (min-width: 640px) {
          .periodic-particle-label {
            font-size: 0.55rem;
          }
        }

        @media (min-width: 1024px) {
          .periodic-particle-label {
            font-size: 0.6rem;
          }
        }

        .dark .periodic-particle-label {
          color: #9ca3af;
        }

        .periodic-particle-spacer {
          pointer-events: none;
        }

        .periodic-cell {
          position: relative;
          padding: 2px;
          min-width: 28px;
          min-height: 28px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .periodic-cell-radiation {
          position: absolute;
          top: 0;
          right: 0;
          padding: 0.5px;
        }

        @media (min-width: 640px) {
          .periodic-cell-radiation {
            top: 1px;
            right: 1px;
            padding: 1px;
          }
        }

        .periodic-cell-radiation-icon {
          width: 6px;
          height: 6px;
          color: #dc2626;
        }

        @media (min-width: 640px) {
          .periodic-cell-radiation-icon {
            width: 8px;
            height: 8px;
          }
        }

        .dark .periodic-cell-radiation-icon {
          color: #f87171;
        }

        .periodic-cell-selected .periodic-cell-radiation-icon {
          color: #fecaca;
        }

        @media (min-width: 640px) {
          .periodic-cell {
            padding: 3px;
            min-width: 32px;
            min-height: 32px;
          }
        }

        @media (min-width: 1024px) {
          .periodic-cell {
            padding: 4px;
            min-width: 38px;
            min-height: 38px;
          }
        }

        .dark .periodic-cell {
          border-color: #4b5563;
          background: #374151;
          color: #e5e7eb;
        }

        .periodic-cell:hover {
          border-color: #3b82f6;
          background: #eff6ff;
          transform: scale(1.05);
          z-index: 10;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        .dark .periodic-cell:hover {
          background: #1e3a8a;
          border-color: #60a5fa;
        }

        .periodic-cell-selected {
          background: #3b82f6;
          border-color: #2563eb;
          color: white;
        }

        .dark .periodic-cell-selected {
          background: #2563eb;
          border-color: #1d4ed8;
        }

        .periodic-cell-selected:hover {
          background: #2563eb;
          border-color: #1d4ed8;
        }

        .dark .periodic-cell-selected:hover {
          background: #1e40af;
          border-color: #1e3a8a;
        }

        .periodic-cell-number {
          font-size: 6px;
          line-height: 1;
          margin-bottom: 1px;
        }

        @media (min-width: 640px) {
          .periodic-cell-number {
            font-size: 7px;
            margin-bottom: 2px;
          }
        }

        @media (min-width: 1024px) {
          .periodic-cell-number {
            font-size: 8px;
          }
        }

        .periodic-cell-symbol {
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
        }

        .periodic-cell-isotope-group {
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 6px;
          margin-left: 6px;
        }

        .periodic-cell-isotope-base {
          display: grid;
          place-items: center;
          min-width: 18px;
          min-height: 18px;
          padding: 2px 4px;
          border: 1px dashed #d1d5db;
          border-radius: 4px;
          background: #ffffff;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        @media (min-width: 640px) {
          .periodic-cell-isotope-base {
            min-width: 22px;
            min-height: 22px;
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 13px;
          }
        }

        @media (min-width: 1024px) {
          .periodic-cell-isotope-base {
            min-width: 26px;
            min-height: 26px;
            padding: 3px 7px;
            font-size: 14px;
          }
        }

        .periodic-cell-isotope-base:hover:not(.periodic-cell-isotope-disabled) {
          border-color: #3b82f6;
          background: #eff6ff;
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        }

        .periodic-cell-isotope-selected {
          background: #3b82f6;
          border-color: #2563eb;
          color: #ffffff;
        }

        .dark .periodic-cell-isotope-base {
          background: #1f2937;
          border-color: #4b5563;
          color: #e5e7eb;
        }

        .dark .periodic-cell-isotope-base:hover:not(.periodic-cell-isotope-disabled) {
          background: #1e3a8a;
          border-color: #60a5fa;
        }

        .dark .periodic-cell-isotope-selected {
          background: #2563eb;
          border-color: #1d4ed8;
        }

        .periodic-cell-isotope-disabled {
          opacity: 0.4;
          cursor: not-allowed;
          background: #f3f4f6;
          color: #9ca3af;
        }

        .periodic-cell-isotope-disabled:hover {
          transform: none;
          box-shadow: none;
          border-color: #d1d5db;
          background: #f3f4f6;
        }

        .dark .periodic-cell-isotope-disabled {
          background: #1f2937;
          border-color: #4b5563;
          color: #6b7280;
        }

        .legend-swatch {
          pointer-events: none;
          cursor: default;
        }

        @media (min-width: 640px) {
          .periodic-cell-symbol {
            font-size: 11px;
          }
        }

        @media (min-width: 1024px) {
          .periodic-cell-symbol {
            font-size: 13px;
          }
        }

        .periodic-cell-empty {
          min-width: 28px;
          min-height: 28px;
        }

        @media (min-width: 640px) {
          .periodic-cell-empty {
            min-width: 32px;
            min-height: 32px;
          }
        }

        @media (min-width: 1024px) {
          .periodic-cell-empty {
            min-width: 38px;
            min-height: 38px;
          }
        }

        .periodic-cell-placeholder {
          min-width: 28px;
          min-height: 28px;
          border: 1px dashed #d1d5db;
          border-radius: 4px;
          background: #f9fafb;
          font-size: 8px;
        }

        @media (min-width: 640px) {
          .periodic-cell-placeholder {
            min-width: 32px;
            min-height: 32px;
            font-size: 9px;
          }
        }

        @media (min-width: 1024px) {
          .periodic-cell-placeholder {
            min-width: 38px;
            min-height: 38px;
            font-size: 10px;
          }
        }

        .dark .periodic-cell-placeholder {
          border-color: #4b5563;
          background: #1f2937;
        }

        .periodic-cell-disabled {
          opacity: 0.3;
          cursor: not-allowed;
          background: #f3f4f6;
        }

        .dark .periodic-cell-disabled {
          background: #1f2937;
        }

        .periodic-cell-disabled:hover {
          transform: none;
          box-shadow: none;
          border-color: #d1d5db;
          background: #f3f4f6;
        }

        .dark .periodic-cell-disabled:hover {
          border-color: #4b5563;
          background: #1f2937;
        }
      `}</style>
    </div>
  )
}
