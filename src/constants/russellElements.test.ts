import { describe, it, expect } from 'vitest'
import {
  RUSSELL_OCTAVES,
  RUSSELL_COLORS,
  POSITION_LABELS,
  getAllRussellElements,
  getRussellElementBySymbol,
  getPredictedElements,
} from './russellElements'

describe('russellElements constants', () => {
  describe('RUSSELL_OCTAVES', () => {
    it('contains 10 octaves', () => {
      expect(RUSSELL_OCTAVES).toHaveLength(10)
    })

    it('has octaves numbered 1 through 10', () => {
      const numbers = RUSSELL_OCTAVES.map(o => o.number)
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('every octave has an inert gas name', () => {
      for (const octave of RUSSELL_OCTAVES) {
        expect(typeof octave.inertGasName).toBe('string')
        expect(octave.inertGasName.length).toBeGreaterThan(0)
      }
    })

    it('every octave has at least one element', () => {
      for (const octave of RUSSELL_OCTAVES) {
        expect(octave.elements.length).toBeGreaterThan(0)
      }
    })

    it('every element has required fields', () => {
      const allElements = getAllRussellElements()
      for (const el of allElements) {
        expect(typeof el.russellName).toBe('string')
        expect(el.russellName.length).toBeGreaterThan(0)
        expect(el.position).toBeGreaterThanOrEqual(-4)
        expect(el.position).toBeLessThanOrEqual(4)
        expect(['generation', 'radiation', 'inertGas']).toContain(el.side)
        expect(['known', 'predicted', 'hypothetical']).toContain(el.status)
      }
    })

    it('inert gases are at position 0', () => {
      const allElements = getAllRussellElements()
      const inertGases = allElements.filter(e => e.side === 'inertGas')

      for (const gas of inertGases) {
        expect(gas.position).toBe(0)
      }
    })

    it('generation elements have negative positions', () => {
      const allElements = getAllRussellElements()
      const generation = allElements.filter(e => e.side === 'generation')

      for (const el of generation) {
        expect(el.position).toBeLessThan(0)
      }
    })

    it('radiation elements have positive positions', () => {
      const allElements = getAllRussellElements()
      const radiation = allElements.filter(e => e.side === 'radiation')

      for (const el of radiation) {
        expect(el.position).toBeGreaterThan(0)
      }
    })

    it('contains known noble gas names', () => {
      const inertGasNames = RUSSELL_OCTAVES.map(o => o.inertGasName)
      // Russell used custom names for some: Helionon instead of Helium
      expect(inertGasNames).toContain('Neon')
      expect(inertGasNames).toContain('Argon')
      expect(inertGasNames).toContain('Krypton')
      expect(inertGasNames).toContain('Xenon')
      expect(inertGasNames).toContain('Radon')
    })
  })

  describe('getAllRussellElements', () => {
    it('returns a flat array of all elements', () => {
      const all = getAllRussellElements()
      expect(all.length).toBeGreaterThan(0)

      // Should be more than just the octave count
      expect(all.length).toBeGreaterThan(RUSSELL_OCTAVES.length)
    })

    it('includes elements from all octaves', () => {
      const all = getAllRussellElements()
      // At minimum we should have all the inert gases
      const totalOctaveElements = RUSSELL_OCTAVES.reduce(
        (sum, o) => sum + o.elements.length,
        0
      )
      expect(all.length).toBe(totalOctaveElements)
    })
  })

  describe('getRussellElementBySymbol', () => {
    it('finds hydrogen by symbol H', () => {
      const h = getRussellElementBySymbol('H')
      expect(h).toBeDefined()
      expect(h!.modernSymbol).toBe('H')
    })

    it('finds carbon by symbol C', () => {
      const c = getRussellElementBySymbol('C')
      expect(c).toBeDefined()
      expect(c!.modernSymbol).toBe('C')
    })

    it('finds silicon by symbol Si', () => {
      const si = getRussellElementBySymbol('Si')
      expect(si).toBeDefined()
      expect(si!.modernSymbol).toBe('Si')
    })

    it('returns undefined for non-existent symbol', () => {
      const result = getRussellElementBySymbol('Zz')
      expect(result).toBeUndefined()
    })
  })

  describe('getPredictedElements', () => {
    it('returns only elements with predicted status', () => {
      const predicted = getPredictedElements()

      for (const el of predicted) {
        expect(el.status).toBe('predicted')
      }
    })

    it('includes Russell-predicted elements (Deuterium, Tritium, Neptunium, Plutonium)', () => {
      const predicted = getPredictedElements()
      const symbols = predicted.map(e => e.modernSymbol).filter(Boolean)

      // Russell predicted these elements before their official discovery
      expect(symbols).toContain('D')  // Deuterium
      expect(symbols).toContain('T')  // Tritium
      expect(symbols).toContain('Np') // Neptunium
      expect(symbols).toContain('Pu') // Plutonium
    })
  })

  describe('RUSSELL_COLORS', () => {
    it('has color definitions for all categories', () => {
      expect(RUSSELL_COLORS.generation).toBeDefined()
      expect(RUSSELL_COLORS.radiation).toBeDefined()
      expect(RUSSELL_COLORS.inertGas).toBeDefined()
      expect(RUSSELL_COLORS.carbon).toBeDefined()
      expect(RUSSELL_COLORS.predicted).toBeDefined()
      expect(RUSSELL_COLORS.hypothetical).toBeDefined()
    })

    it('has light and dark variants for each category', () => {
      for (const [, colors] of Object.entries(RUSSELL_COLORS)) {
        expect(colors.light).toBeDefined()
        expect(colors.dark).toBeDefined()
        expect(typeof colors.light).toBe('string')
        expect(typeof colors.dark).toBe('string')
      }
    })

    it('has background variants for each category', () => {
      for (const [, colors] of Object.entries(RUSSELL_COLORS)) {
        expect(colors.bg.light).toBeDefined()
        expect(colors.bg.dark).toBeDefined()
      }
    })

    it('all colors are valid hex codes', () => {
      const hexRegex = /^#[0-9a-f]{6}$/i
      for (const [, colors] of Object.entries(RUSSELL_COLORS)) {
        expect(colors.light).toMatch(hexRegex)
        expect(colors.dark).toMatch(hexRegex)
        expect(colors.bg.light).toMatch(hexRegex)
        expect(colors.bg.dark).toMatch(hexRegex)
      }
    })
  })

  describe('POSITION_LABELS', () => {
    it('has 9 labels (positions -4 to +4)', () => {
      expect(POSITION_LABELS).toHaveLength(9)
    })

    it('has generation labels for first 4 positions', () => {
      expect(POSITION_LABELS[0]).toBe('Gen 4')
      expect(POSITION_LABELS[1]).toBe('Gen 3')
      expect(POSITION_LABELS[2]).toBe('Gen 2')
      expect(POSITION_LABELS[3]).toBe('Gen 1')
    })

    it('has Inert Gas at center position', () => {
      expect(POSITION_LABELS[4]).toBe('Inert Gas')
    })

    it('has radiation labels for last 4 positions', () => {
      expect(POSITION_LABELS[5]).toBe('Rad 1')
      expect(POSITION_LABELS[6]).toBe('Rad 2')
      expect(POSITION_LABELS[7]).toBe('Rad 3')
      expect(POSITION_LABELS[8]).toBe('Rad 4')
    })
  })
})
