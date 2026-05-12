import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Database } from 'sql.js'
import type { WeightedNuclide } from '../types'
import {
  compareAbundances,
  getAbundanceSourceLabel,
  getAbundanceSourceDescription,
} from './abundanceComparison'

// Mock proportionService to avoid needing a real database
vi.mock('./proportionService', () => ({
  getNaturalAbundances: vi.fn(),
}))

import { getNaturalAbundances } from './proportionService'

const mockDb = {} as Database
const mockGetNaturalAbundances = vi.mocked(getNaturalAbundances)

describe('abundanceComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('compareAbundances', () => {
    it('computes delta for matching nuclide IDs', () => {
      const parkhomov: WeightedNuclide[] = [
        { nuclideId: 'Li-6', proportion: 7.59, sourceType: 'natural' },
        { nuclideId: 'Li-7', proportion: 92.41, sourceType: 'natural' },
      ]
      const iaea: WeightedNuclide[] = [
        { nuclideId: 'Li-6', proportion: 4.85, sourceType: 'natural' },
        { nuclideId: 'Li-7', proportion: 95.15, sourceType: 'natural' },
      ]

      mockGetNaturalAbundances
        .mockReturnValueOnce(parkhomov) // first call: parkhomov
        .mockReturnValueOnce(iaea)      // second call: iaea

      const result = compareAbundances(mockDb, 'Li')

      expect(result.element).toBe('Li')
      expect(result.hasBothSources).toBe(true)
      expect(result.isotopes).toHaveLength(2)

      const li6 = result.isotopes.find((i) => i.nuclideId === 'Li-6')
      expect(li6).toBeDefined()
      expect(li6!.parkhomov).toBe(7.59)
      expect(li6!.iaea).toBe(4.85)
      expect(li6!.delta).toBeCloseTo(4.85 - 7.59, 4)
      expect(li6!.absDelta).toBeCloseTo(Math.abs(4.85 - 7.59), 4)
    })

    it('sorts isotopes by mass number', () => {
      const parkhomov: WeightedNuclide[] = [
        { nuclideId: 'Fe-58', proportion: 0.28, sourceType: 'natural' },
        { nuclideId: 'Fe-54', proportion: 5.85, sourceType: 'natural' },
        { nuclideId: 'Fe-56', proportion: 91.75, sourceType: 'natural' },
        { nuclideId: 'Fe-57', proportion: 2.12, sourceType: 'natural' },
      ]
      const iaea: WeightedNuclide[] = [
        { nuclideId: 'Fe-54', proportion: 5.845, sourceType: 'natural' },
        { nuclideId: 'Fe-56', proportion: 91.754, sourceType: 'natural' },
        { nuclideId: 'Fe-57', proportion: 2.119, sourceType: 'natural' },
        { nuclideId: 'Fe-58', proportion: 0.282, sourceType: 'natural' },
      ]

      mockGetNaturalAbundances
        .mockReturnValueOnce(parkhomov)
        .mockReturnValueOnce(iaea)

      const result = compareAbundances(mockDb, 'Fe')
      const massNumbers = result.isotopes.map((i) =>
        parseInt(i.nuclideId.split('-')[1], 10)
      )
      expect(massNumbers).toEqual([54, 56, 57, 58])
    })

    it('computes maxDelta across all isotopes', () => {
      const parkhomov: WeightedNuclide[] = [
        { nuclideId: 'Li-6', proportion: 7.59, sourceType: 'natural' },
        { nuclideId: 'Li-7', proportion: 92.41, sourceType: 'natural' },
      ]
      const iaea: WeightedNuclide[] = [
        { nuclideId: 'Li-6', proportion: 4.85, sourceType: 'natural' },
        { nuclideId: 'Li-7', proportion: 95.15, sourceType: 'natural' },
      ]

      mockGetNaturalAbundances
        .mockReturnValueOnce(parkhomov)
        .mockReturnValueOnce(iaea)

      const result = compareAbundances(mockDb, 'Li')
      // Max delta is |95.15 - 92.41| = 2.74
      expect(result.maxDelta).toBeCloseTo(2.74, 2)
    })

    it('handles nuclides present in only one source', () => {
      const parkhomov: WeightedNuclide[] = [
        { nuclideId: 'X-10', proportion: 50, sourceType: 'natural' },
        { nuclideId: 'X-11', proportion: 50, sourceType: 'natural' },
      ]
      const iaea: WeightedNuclide[] = [
        { nuclideId: 'X-10', proportion: 60, sourceType: 'natural' },
        { nuclideId: 'X-12', proportion: 40, sourceType: 'natural' },
      ]

      mockGetNaturalAbundances
        .mockReturnValueOnce(parkhomov)
        .mockReturnValueOnce(iaea)

      const result = compareAbundances(mockDb, 'X')
      expect(result.isotopes).toHaveLength(3)

      const x10 = result.isotopes.find((i) => i.nuclideId === 'X-10')
      expect(x10!.parkhomov).toBe(50)
      expect(x10!.iaea).toBe(60)
      expect(x10!.delta).toBe(10)

      const x11 = result.isotopes.find((i) => i.nuclideId === 'X-11')
      expect(x11!.parkhomov).toBe(50)
      expect(x11!.iaea).toBeNull()
      expect(x11!.delta).toBeNull()

      const x12 = result.isotopes.find((i) => i.nuclideId === 'X-12')
      expect(x12!.parkhomov).toBeNull()
      expect(x12!.iaea).toBe(40)
      expect(x12!.delta).toBeNull()
    })

    it('returns hasBothSources=false when one source is empty', () => {
      mockGetNaturalAbundances
        .mockReturnValueOnce([]) // parkhomov: empty
        .mockReturnValueOnce([
          { nuclideId: 'Y-89', proportion: 100, sourceType: 'natural' },
        ])

      const result = compareAbundances(mockDb, 'Y')
      expect(result.hasBothSources).toBe(false)
    })

    it('returns empty isotopes when both sources are empty', () => {
      mockGetNaturalAbundances
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])

      const result = compareAbundances(mockDb, 'Zz')
      expect(result.isotopes).toHaveLength(0)
      expect(result.maxDelta).toBe(0)
      expect(result.hasBothSources).toBe(false)
    })

    it('passes correct source parameter to getNaturalAbundances', () => {
      mockGetNaturalAbundances.mockReturnValue([])

      compareAbundances(mockDb, 'Li')

      expect(mockGetNaturalAbundances).toHaveBeenCalledTimes(2)
      expect(mockGetNaturalAbundances).toHaveBeenCalledWith(mockDb, 'Li', 'parkhomov')
      expect(mockGetNaturalAbundances).toHaveBeenCalledWith(mockDb, 'Li', 'iaea')
    })
  })

  describe('getAbundanceSourceLabel', () => {
    it('returns label for parkhomov', () => {
      expect(getAbundanceSourceLabel('parkhomov')).toBe('Parkhomov Database')
    })

    it('returns label for iaea', () => {
      expect(getAbundanceSourceLabel('iaea')).toBe('IAEA NuBase 2020')
    })
  })

  describe('getAbundanceSourceDescription', () => {
    it('returns description for parkhomov', () => {
      const desc = getAbundanceSourceDescription('parkhomov')
      expect(desc).toContain('Parkhomov')
    })

    it('returns description for iaea', () => {
      const desc = getAbundanceSourceDescription('iaea')
      expect(desc).toContain('IAEA')
      expect(desc).toContain('NuBase 2020')
    })
  })
})
