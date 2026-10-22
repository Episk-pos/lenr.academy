import { describe, it, expect } from 'vitest'
import { expandHalfLifeUnit, normalizeElementSymbol, formatDensity, formatSpecificHeat, densityToGPerCm3 } from './formatUtils'

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

describe('formatDensity (input kg/m³)', () => {
  it('formats solids and liquids in g/cm³', () => {
    expect(formatDensity(7874)).toBe('7.874 g/cm³') // Fe
    expect(formatDensity(22610)).toBe('22.610 g/cm³') // Os
    expect(formatDensity(13534)).toBe('13.534 g/cm³') // Hg
    expect(formatDensity(534)).toBe('0.534 g/cm³') // Li
  })

  it('formats gases in g/L', () => {
    expect(formatDensity(0.0899)).toBe('0.0899 g/L') // H
    expect(formatDensity(9.73)).toBe('9.73 g/L') // Rn
  })
})

describe('densityToGPerCm3', () => {
  it('converts kg/m³ to g/cm³', () => {
    expect(densityToGPerCm3(7874)).toBeCloseTo(7.874)
  })
})

describe('formatSpecificHeat (input J/(kg·K))', () => {
  it('formats in J/(g·K) with 3 decimals', () => {
    expect(formatSpecificHeat(449)).toBe('0.449 J/(g·K)') // Fe
    expect(formatSpecificHeat(14300)).toBe('14.300 J/(g·K)') // H
  })
})
