import { describe, it, expect } from 'vitest'
import {
  IAEA_ABUNDANCES,
  IAEA_METADATA,
  getIAEAAbundancesForElement,
  getIAEAAbundance,
} from './iaeaAbundances'

describe('IAEA Abundance Data', () => {
  it('contains abundance data for multiple nuclides', () => {
    expect(IAEA_ABUNDANCES.length).toBeGreaterThan(250)
  })

  it('has metadata with extraction date and counts', () => {
    expect(IAEA_METADATA.source).toContain('IAEA')
    expect(IAEA_METADATA.nuclideCount).toBeGreaterThan(250)
    expect(IAEA_METADATA.elementCount).toBeGreaterThan(70)
    expect(IAEA_METADATA.extractionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('has valid structure for each entry', () => {
    for (const entry of IAEA_ABUNDANCES) {
      expect(entry.z).toBeGreaterThanOrEqual(1)
      expect(entry.a).toBeGreaterThanOrEqual(1)
      expect(entry.symbol).toBeTruthy()
      expect(entry.abundance).toBeGreaterThan(0)
      expect(entry.abundance).toBeLessThanOrEqual(100)
    }
  })

  it('contains hydrogen isotope data', () => {
    const hydrogen = IAEA_ABUNDANCES.filter((a) => a.z === 1)
    expect(hydrogen.length).toBeGreaterThanOrEqual(2) // H-1 and D-2

    const h1 = hydrogen.find((h) => h.a === 1)
    expect(h1).toBeDefined()
    expect(h1!.abundance).toBeGreaterThan(99)
    expect(h1!.symbol).toBe('H')

    const d2 = hydrogen.find((h) => h.a === 2)
    expect(d2).toBeDefined()
    expect(d2!.abundance).toBeLessThan(1)
    expect(d2!.symbol).toBe('D') // Parkhomov convention
  })

  it('has lithium isotopes summing to approximately 100%', () => {
    const lithium = IAEA_ABUNDANCES.filter((a) => a.symbol === 'Li')
    expect(lithium.length).toBe(2)
    const sum = lithium.reduce((s, l) => s + l.abundance, 0)
    expect(sum).toBeCloseTo(100, 0)
  })

  it('has nickel isotopes with expected dominant isotope', () => {
    const nickel = IAEA_ABUNDANCES.filter((a) => a.symbol === 'Ni')
    expect(nickel.length).toBe(5)
    // Ni-58 should be the most abundant
    const ni58 = nickel.find((n) => n.a === 58)
    expect(ni58).toBeDefined()
    expect(ni58!.abundance).toBeGreaterThan(60)
  })

  it('includes uncertainty data for most entries', () => {
    const withUncertainty = IAEA_ABUNDANCES.filter((a) => a.uncertainty !== null)
    // Most entries should have uncertainty
    expect(withUncertainty.length).toBeGreaterThan(IAEA_ABUNDANCES.length * 0.5)
  })

  it('is sorted by Z then A', () => {
    for (let i = 1; i < IAEA_ABUNDANCES.length; i++) {
      const prev = IAEA_ABUNDANCES[i - 1]
      const curr = IAEA_ABUNDANCES[i]
      if (prev.z === curr.z) {
        expect(curr.a).toBeGreaterThanOrEqual(prev.a)
      } else {
        expect(curr.z).toBeGreaterThan(prev.z)
      }
    }
  })
})

describe('getIAEAAbundancesForElement', () => {
  it('returns all hydrogen isotopes for H', () => {
    const result = getIAEAAbundancesForElement('H')
    expect(result.length).toBe(1) // Only H-1 (D is separate)
    expect(result[0].a).toBe(1)
  })

  it('returns deuterium for D', () => {
    const result = getIAEAAbundancesForElement('D')
    expect(result.length).toBe(1)
    expect(result[0].a).toBe(2)
    expect(result[0].symbol).toBe('D')
  })

  it('returns lithium isotopes', () => {
    const result = getIAEAAbundancesForElement('Li')
    expect(result.length).toBe(2)
    expect(result.map((r) => r.a).sort()).toEqual([6, 7])
  })

  it('returns empty array for unknown element', () => {
    const result = getIAEAAbundancesForElement('Zz')
    expect(result).toEqual([])
  })

  it('returns iron isotopes', () => {
    const result = getIAEAAbundancesForElement('Fe')
    expect(result.length).toBe(4)
    const fe56 = result.find((r) => r.a === 56)
    expect(fe56).toBeDefined()
    expect(fe56!.abundance).toBeGreaterThan(90)
  })
})

describe('getIAEAAbundance', () => {
  it('returns abundance for H-1', () => {
    const result = getIAEAAbundance('H', 1)
    expect(result).toBeGreaterThan(99)
  })

  it('returns abundance for D-2', () => {
    const result = getIAEAAbundance('D', 2)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(1)
  })

  it('returns null for non-existent nuclide', () => {
    expect(getIAEAAbundance('H', 99)).toBeNull()
  })

  it('returns null for unknown element', () => {
    expect(getIAEAAbundance('Zz', 1)).toBeNull()
  })

  it('returns correct value for Fe-56', () => {
    const result = getIAEAAbundance('Fe', 56)
    expect(result).toBeCloseTo(91.754, 1)
  })
})
