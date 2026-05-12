import { describe, it, expect } from 'vitest'
import { expandHalfLifeUnit, normalizeElementSymbol } from './formatUtils'

describe('expandHalfLifeUnit', () => {
  it('returns empty string for null input', () => {
    expect(expandHalfLifeUnit(null)).toBe('')
  })

  it('keeps sub-second SI abbreviations unchanged', () => {
    expect(expandHalfLifeUnit('fs')).toBe('fs')
    expect(expandHalfLifeUnit('ps')).toBe('ps')
    expect(expandHalfLifeUnit('ns')).toBe('ns')
    expect(expandHalfLifeUnit('µs')).toBe('µs')
    expect(expandHalfLifeUnit('ms')).toBe('ms')
  })

  it('normalizes ASCII "us" to proper µs', () => {
    expect(expandHalfLifeUnit('us')).toBe('µs')
    expect(expandHalfLifeUnit('US')).toBe('µs')
  })

  it('expands second-and-longer units to full words', () => {
    expect(expandHalfLifeUnit('s')).toBe('seconds')
    expect(expandHalfLifeUnit('m')).toBe('minutes')
    expect(expandHalfLifeUnit('h')).toBe('hours')
    expect(expandHalfLifeUnit('d')).toBe('days')
    expect(expandHalfLifeUnit('y')).toBe('years')
  })

  it('handles uppercase variants from database', () => {
    expect(expandHalfLifeUnit('S')).toBe('seconds')
    expect(expandHalfLifeUnit('M')).toBe('minutes')
    expect(expandHalfLifeUnit('H')).toBe('hours')
    expect(expandHalfLifeUnit('D')).toBe('days')
    expect(expandHalfLifeUnit('Y')).toBe('years')
    expect(expandHalfLifeUnit('FS')).toBe('fs')
    expect(expandHalfLifeUnit('PS')).toBe('ps')
    expect(expandHalfLifeUnit('NS')).toBe('ns')
    expect(expandHalfLifeUnit('MS')).toBe('ms')
  })

  it('returns unknown abbreviations unchanged', () => {
    expect(expandHalfLifeUnit('Gy')).toBe('Gy')
    expect(expandHalfLifeUnit('unknown')).toBe('unknown')
  })
})

describe('normalizeElementSymbol', () => {
  it('maps deuterium D to hydrogen H', () => {
    expect(normalizeElementSymbol('D')).toBe('H')
  })

  it('maps tritium T to hydrogen H', () => {
    expect(normalizeElementSymbol('T')).toBe('H')
  })

  it('passes through regular hydrogen H unchanged', () => {
    expect(normalizeElementSymbol('H')).toBe('H')
  })

  it('passes through other element symbols unchanged', () => {
    expect(normalizeElementSymbol('C')).toBe('C')
    expect(normalizeElementSymbol('Fe')).toBe('Fe')
    expect(normalizeElementSymbol('U')).toBe('U')
    expect(normalizeElementSymbol('Pd')).toBe('Pd')
  })
})
