import { describe, it, expect } from 'vitest'
import {
  parseNuclideNotation,
  getMatchScore,
  findElementsByName,
  filterDataBySearch,
  ElementInfo,
} from './searchUtils'

describe('parseNuclideNotation', () => {
  it('parses element-mass with dash (In-49)', () => {
    expect(parseNuclideNotation('In-49')).toEqual({ element: 'In', massNumber: 49 })
  })

  it('parses element-mass without dash (In49)', () => {
    expect(parseNuclideNotation('In49')).toEqual({ element: 'In', massNumber: 49 })
  })

  it('parses single-letter elements (U-238)', () => {
    expect(parseNuclideNotation('U-238')).toEqual({ element: 'U', massNumber: 238 })
    expect(parseNuclideNotation('U238')).toEqual({ element: 'U', massNumber: 238 })
  })

  it('parses lowercase (he-4)', () => {
    expect(parseNuclideNotation('he-4')).toEqual({ element: 'he', massNumber: 4 })
  })

  it('returns null for plain text without numbers', () => {
    expect(parseNuclideNotation('Helium')).toBeNull()
  })

  it('returns null for plain numbers', () => {
    expect(parseNuclideNotation('123')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseNuclideNotation('')).toBeNull()
  })

  it('returns null for three-letter element symbols', () => {
    // Only 1-2 letter element symbols are valid
    expect(parseNuclideNotation('Abc-12')).toBeNull()
  })
})

describe('getMatchScore', () => {
  it('returns 1000 for exact case-sensitive match', () => {
    expect(getMatchScore('Helium', 'Helium')).toBe(1000)
  })

  it('returns 900 for exact case-insensitive match', () => {
    expect(getMatchScore('Helium', 'helium')).toBe(900)
  })

  it('returns 800 for case-sensitive starts-with', () => {
    expect(getMatchScore('Helium', 'Hel')).toBe(800)
  })

  it('returns 700 for case-insensitive starts-with', () => {
    expect(getMatchScore('Helium', 'hel')).toBe(700)
  })

  it('returns 600 for case-sensitive substring', () => {
    expect(getMatchScore('Helium', 'liu')).toBe(600)
  })

  it('returns 500 for case-insensitive substring', () => {
    expect(getMatchScore('Helium', 'LIU')).toBe(500)
  })

  it('returns 100 for fuzzy match (characters in order)', () => {
    expect(getMatchScore('Helium', 'Hm')).toBe(100)
  })

  it('returns 0 for no match', () => {
    expect(getMatchScore('Helium', 'xyz')).toBe(0)
  })

  it('returns 0 when fuzzy match characters are out of order', () => {
    expect(getMatchScore('Helium', 'mH')).toBe(0)
  })
})

describe('findElementsByName', () => {
  const elements: ElementInfo[] = [
    { symbol: 'H', name: 'Hydrogen', Z: 1 },
    { symbol: 'He', name: 'Helium', Z: 2 },
    { symbol: 'Li', name: 'Lithium', Z: 3 },
    { symbol: 'Fe', name: 'Iron', Z: 26 },
  ]

  it('finds elements by exact name', () => {
    const matches = findElementsByName('Iron', elements)
    expect(matches.has('Fe')).toBe(true)
    expect(matches.get('Fe')).toBe(1000)
  })

  it('finds elements by partial name', () => {
    const matches = findElementsByName('Hel', elements)
    expect(matches.has('He')).toBe(true)
    expect(matches.get('He')).toBe(800)
  })

  it('finds multiple elements with shared substring', () => {
    const matches = findElementsByName('ium', elements)
    expect(matches.has('He')).toBe(true) // Hel-ium
    expect(matches.has('Li')).toBe(true) // Lith-ium
    expect(matches.has('Fe')).toBe(false) // Iron
  })

  it('returns empty map for no matches', () => {
    const matches = findElementsByName('xyz', elements)
    expect(matches.size).toBe(0)
  })
})

describe('filterDataBySearch', () => {
  const columns = [
    { key: 'E' },
    { key: 'Z' },
    { key: 'A' },
  ]

  const data = [
    { E: 'H', Z: 1, A: 1 },
    { E: 'He', Z: 2, A: 4 },
    { E: 'Li', Z: 3, A: 7 },
    { E: 'Fe', Z: 26, A: 56 },
  ]

  it('returns all data when search term is empty', () => {
    expect(filterDataBySearch(data, columns, '')).toEqual(data)
  })

  it('filters by element symbol', () => {
    const result = filterDataBySearch(data, columns, 'He')
    expect(result).toHaveLength(1)
    expect(result[0].E).toBe('He')
  })

  it('filters by atomic number', () => {
    const result = filterDataBySearch(data, columns, '26')
    expect(result.some(r => r.E === 'Fe')).toBe(true)
  })

  it('filters by nuclide notation', () => {
    const result = filterDataBySearch(data, columns, 'Fe-56')
    expect(result).toHaveLength(1)
    expect(result[0].E).toBe('Fe')
  })

  it('returns empty array when nothing matches', () => {
    const result = filterDataBySearch(data, columns, 'Xyz99')
    expect(result).toHaveLength(0)
  })

  it('sorts results by match score (exact matches first)', () => {
    const result = filterDataBySearch(data, columns, 'H')
    // 'H' exact match should come before 'He' starts-with
    expect(result[0].E).toBe('H')
  })

  it('supports element name searching with metadata', () => {
    const elements: ElementInfo[] = [
      { symbol: 'H', name: 'Hydrogen', Z: 1 },
      { symbol: 'He', name: 'Helium', Z: 2 },
      { symbol: 'Li', name: 'Lithium', Z: 3 },
      { symbol: 'Fe', name: 'Iron', Z: 26 },
    ]
    const result = filterDataBySearch(data, columns, 'Iron', { elements })
    expect(result.some(r => r.E === 'Fe')).toBe(true)
  })
})
