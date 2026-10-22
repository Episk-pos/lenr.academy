import { describe, it, expect } from 'vitest'
import {
  COMPTON_ELECTRON,
  findResonance,
  placeInBand,
  electronZ,
  parseBandParams,
  writeBandParams,
  findResonantPartners,
  computeTopGlobalPairs,
  formatWavelength,
  BAND_PRESETS,
  DEFAULT_CUSTOM_BAND,
} from './mullerResonanceService'

const ELEMENTS = Array.from({ length: 92 }, (_, i) => ({ Z: i + 1, E: `E${i + 1}` }))

describe('findResonance', () => {
  it('returns null for invalid pairs', () => {
    expect(findResonance(0, 26)).toBeNull()
    expect(findResonance(26, 0)).toBeNull()
    expect(findResonance(26, 26)).toBeNull()
  })

  it('finds Cu–Fe: Cu electrons, Fe protons, ΔN = 11, ≈0.0008% mismatch', () => {
    const m = findResonance(29, 26)!
    expect(m).not.toBeNull()
    expect(m.deltaN).toBe(11)
    expect(m.electronIsZ1).toBe(true)
    expect(m.mismatchPct).toBeCloseTo(0.000803, 5)
  })

  it('is symmetric in argument order (orientation flips, ΔN and mismatch do not)', () => {
    const a = findResonance(29, 26)!
    const b = findResonance(26, 29)!
    expect(b.deltaN).toBe(a.deltaN)
    expect(b.mismatchPct).toBeCloseTo(a.mismatchPct, 12)
    expect(b.electronIsZ1).toBe(false)
  })

  it('matches other known exact pairs', () => {
    // Z_e · 1836.15 ≈ Z_p · 2^ΔN
    expect(findResonance(29, 13)).toMatchObject({ deltaN: 12, electronIsZ1: true })
    expect(findResonance(58, 26)).toMatchObject({ deltaN: 12, electronIsZ1: true })
    expect(findResonance(29, 52)).toMatchObject({ deltaN: 10, electronIsZ1: true })
    expect(findResonance(87, 78)).toMatchObject({ deltaN: 11, electronIsZ1: true })
  })

  it('exactly 8 of the 4,186 pairs among Z=1..92 match to < 0.01%', () => {
    let exact = 0
    let total = 0
    for (let a = 1; a <= 92; a++) {
      for (let b = a + 1; b <= 92; b++) {
        total++
        const m = findResonance(a, b)
        if (m && m.mismatchPct < 0.01) exact++
      }
    }
    expect(total).toBe(4186)
    expect(exact).toBe(8)
  })

  it('ΔN alone captures the resonance: the condition holds equally at every N', () => {
    const m = findResonance(29, 26)!
    const COMPTON_PROTON = COMPTON_ELECTRON / 1836.15267
    const relErrs = [0, 5, 20, 31, 40].map(N => {
      const Le = 29 * COMPTON_ELECTRON * 2 ** N
      const Lp = 26 * COMPTON_PROTON * 2 ** (N + m.deltaN)
      return Math.abs(Le - Lp) / Lp * 100
    })
    for (const err of relErrs) {
      expect(err).toBeCloseTo(m.mismatchPct, 9)
    }
  })

  it('has no N-dependent fields', () => {
    expect(Object.keys(findResonance(29, 26)!).sort()).toEqual(['deltaN', 'electronIsZ1', 'mismatchPct'])
  })
})

describe('placeInBand', () => {
  const cuFe = findResonance(29, 26)!

  it('places Cu–Fe in the mm band: N = 24..33 including N = 31 → 151.10 mm', () => {
    const rungs = placeInBand(cuFe, 29, BAND_PRESETS.mm.min, BAND_PRESETS.mm.max)
    expect(rungs.map(r => r.N)).toEqual([24, 25, 26, 27, 28, 29, 30, 31, 32, 33])
    const n31 = rungs.find(r => r.N === 31)!
    expect(n31.protonN).toBe(42)
    expect(n31.wavelength * 1000).toBeCloseTo(151.10, 2)
    expect(formatWavelength(n31.wavelength)).toBe('151.10 mm')
  })

  it('places Cu–Fe in the µm band with N = 20 → 73.78 µm', () => {
    const rungs = placeInBand(cuFe, 29, BAND_PRESETS.um.min, BAND_PRESETS.um.max)
    expect(rungs[0].N).toBe(14)
    const n20 = rungs.find(r => r.N === 20)!
    expect(n20.protonN).toBe(31)
    expect(formatWavelength(n20.wavelength)).toBe('73.78 µm')
  })

  it('each rung doubles the previous wavelength and protonN = N + ΔN', () => {
    const rungs = placeInBand(cuFe, 29, 1e-9, 10)
    expect(rungs.length).toBeGreaterThan(5)
    for (let i = 1; i < rungs.length; i++) {
      expect(rungs[i].N).toBe(rungs[i - 1].N + 1)
      expect(rungs[i].wavelength / rungs[i - 1].wavelength).toBeCloseTo(2, 12)
    }
    for (const r of rungs) expect(r.protonN - r.N).toBe(11)
  })

  it('respects bounds (inclusive) and never goes below N = 0', () => {
    const base = 29 * COMPTON_ELECTRON
    // Band starting exactly on a rung includes it
    const exact = placeInBand(cuFe, 29, base * 2 ** 10, base * 2 ** 12)
    expect(exact.map(r => r.N)).toEqual([10, 11, 12])
    // Band below the N=0 rung only yields N ≥ 0
    const low = placeInBand(cuFe, 29, 1e-15, base * 2)
    expect(low.map(r => r.N)).toEqual([0, 1])
    for (const r of placeInBand(cuFe, 29, 1e-6, 1)) {
      expect(r.wavelength).toBeGreaterThanOrEqual(1e-6)
      expect(r.wavelength).toBeLessThanOrEqual(1)
    }
  })

  it('returns an empty ladder for a band narrower than one octave that misses every rung', () => {
    const base = 29 * COMPTON_ELECTRON
    expect(placeInBand(cuFe, 29, base * 2 ** 20 * 1.1, base * 2 ** 20 * 1.9)).toEqual([])
  })

  it('returns an empty ladder for invalid bands', () => {
    expect(placeInBand(cuFe, 29, 1, 1e-3)).toEqual([])
    expect(placeInBand(cuFe, 29, 0, 1)).toEqual([])
    expect(placeInBand(cuFe, 29, NaN, 1)).toEqual([])
    expect(placeInBand(cuFe, 0, 1e-6, 1)).toEqual([])
  })
})

describe('pair helpers', () => {
  it('findResonantPartners returns ΔN and electron side; Cu partners include Fe', () => {
    const { pairs } = findResonantPartners(29, 'Cu', ELEMENTS, 1)
    const fe = pairs.find(p => p.Z2 === 26)!
    expect(fe.deltaN).toBe(11)
    expect(fe.electronElement).toBe('Z1')
    expect(electronZ(fe)).toBe(29)
    expect(fe).not.toHaveProperty('wavelength')
    expect(fe).not.toHaveProperty('electronOctave')
  })

  it('electronZ resolves the electron side for Z2-electron pairs', () => {
    const { pairs } = findResonantPartners(26, 'Fe', ELEMENTS, 1)
    const cu = pairs.find(p => p.Z2 === 29)!
    expect(cu.electronElement).toBe('Z2')
    expect(electronZ(cu)).toBe(29)
  })

  it('computeTopGlobalPairs puts the electron element first', () => {
    const top = computeTopGlobalPairs(ELEMENTS, 8)
    expect(top).toHaveLength(8)
    const cuFe = top.find(p => (p.Z1 === 29 && p.Z2 === 26))!
    expect(cuFe).toBeDefined()
    expect(cuFe.deltaN).toBe(11)
    expect(electronZ(cuFe)).toBe(29)
  })
})

describe('band URL params', () => {
  const parse = (qs: string) => parseBandParams(new URLSearchParams(qs))

  it('defaults to ratio only', () => {
    expect(parse('').band).toBe('none')
    expect(parse('band=bogus').band).toBe('none')
  })

  it('parses presets', () => {
    expect(parse('band=um')).toEqual({ band: 'um', min: 1e-6, max: 1e-3 })
    expect(parse('band=mm')).toEqual({ band: 'mm', min: 1e-3, max: 1 })
    expect(parse('band=cm-m')).toEqual({ band: 'cm-m', min: 1e-2, max: 10 })
  })

  it('parses custom bounds in metres, swapping reversed bounds', () => {
    expect(parse('band=custom&bmin=0.005&bmax=0.2')).toEqual({ band: 'custom', min: 0.005, max: 0.2 })
    expect(parse('band=custom&bmin=0.2&bmax=0.005')).toEqual({ band: 'custom', min: 0.005, max: 0.2 })
    expect(parse('band=custom&bmin=1e-9&bmax=2e-9')).toEqual({ band: 'custom', min: 1e-9, max: 2e-9 })
  })

  it('falls back to the default custom range for missing or invalid bounds', () => {
    for (const qs of ['band=custom', 'band=custom&bmin=abc&bmax=1', 'band=custom&bmin=-1&bmax=1', 'band=custom&bmin=0&bmax=1']) {
      expect(parse(qs)).toEqual({ band: 'custom', ...DEFAULT_CUSTOM_BAND })
    }
  })

  it('round-trips through writeBandParams and leaves other params alone', () => {
    for (const qs of ['band=um', 'band=mm', 'band=cm-m', 'band=custom&bmin=0.005&bmax=0.2']) {
      const sel = parse(qs)
      const out = writeBandParams(new URLSearchParams('element=Cu&band=x&bmin=1'), sel)
      expect(out.get('element')).toBe('Cu')
      expect(parseBandParams(out)).toEqual(sel)
    }
    const cleared = writeBandParams(new URLSearchParams('element=Cu&band=mm&bmin=1&bmax=2'), { band: 'none', min: 0, max: 0 })
    expect(cleared.toString()).toBe('element=Cu')
  })
})
