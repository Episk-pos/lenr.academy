import { describe, it, expect, vi } from 'vitest'
import type { Database } from 'sql.js'
import {
  FALLBACK_NUCLIDE_COUNT,
  MIN_MAX_NUCLIDES,
  clampMaxNuclides,
  deriveMaxNuclides,
  resolveNuclideCount,
} from './cascadeParams'
import { getNuclideCount } from '../services/queryService'

function fakeDb(rows: unknown[][] | null): Database {
  return {
    exec: vi.fn(() => (rows ? [{ columns: ['COUNT(*)'], values: rows }] : [])),
  } as unknown as Database
}

describe('getNuclideCount', () => {
  it('returns the NuclidesPlus row count', () => {
    const db = fakeDb([[324]])
    expect(getNuclideCount(db)).toBe(324)
    expect(db.exec).toHaveBeenCalledWith('SELECT COUNT(*) FROM NuclidesPlus')
  })

  it('returns 0 when the query yields nothing', () => {
    expect(getNuclideCount(fakeDb(null))).toBe(0)
    expect(getNuclideCount(fakeDb([]))).toBe(0)
  })
})

describe('resolveNuclideCount', () => {
  it('uses the DB count when it is positive', () => {
    expect(resolveNuclideCount(400)).toBe(400)
  })

  it('falls back when the count is missing or invalid', () => {
    expect(resolveNuclideCount(0)).toBe(FALLBACK_NUCLIDE_COUNT)
    expect(resolveNuclideCount(undefined)).toBe(FALLBACK_NUCLIDE_COUNT)
    expect(resolveNuclideCount(NaN)).toBe(FALLBACK_NUCLIDE_COUNT)
  })
})

describe('clampMaxNuclides', () => {
  it('caps values above the DB nuclide count (e.g. the old 5000 default)', () => {
    expect(clampMaxNuclides(5000, 324)).toBe(324)
  })

  it('raises values below the slider minimum', () => {
    expect(clampMaxNuclides(1, 324)).toBe(MIN_MAX_NUCLIDES)
  })

  it('keeps in-range values', () => {
    expect(clampMaxNuclides(150, 324)).toBe(150)
  })

  it('treats non-finite values as the maximum', () => {
    expect(clampMaxNuclides(NaN, 324)).toBe(324)
  })
})

describe('deriveMaxNuclides', () => {
  it('defaults to the DB count when the value was not set explicitly', () => {
    expect(deriveMaxNuclides(FALLBACK_NUCLIDE_COUNT, 400, false)).toBe(400)
  })

  it('clamps but preserves explicit values', () => {
    expect(deriveMaxNuclides(100, 400, true)).toBe(100)
    expect(deriveMaxNuclides(5000, 400, true)).toBe(400)
  })
})
