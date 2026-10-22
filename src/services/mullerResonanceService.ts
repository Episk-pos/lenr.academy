/**
 * Muller Resonance Service
 *
 * Implements Frithjof Muller's equation: L = Z × C × 2^N
 * where L is the resonance wavelength, Z is atomic number,
 * C is the Compton wavelength (electron or proton), and N is the octave number.
 *
 * Two elements share a cross-particle resonance when one element's electron
 * ladder lines up with the other element's proton ladder:
 *
 *   Z1 · λe · 2^N = Z2 · λp · 2^(N + ΔN)   ⇔   Z1 / Z2 = 2^ΔN / (λe/λp)
 *
 * N cancels out of the condition, so if it holds at one octave it holds at
 * every octave. A resonance therefore fixes only the octave GAP ΔN (and the
 * mismatch %), never an absolute octave. Choosing a wavelength band is what
 * selects which rung(s) of the ladder to display — see `placeInBand`.
 *
 * Example: Copper (Z=29) electrons and Iron (Z=26) protons match with
 * ΔN = 11 to 0.0008%. At N = 31 / 42 that is L ≈ 151.1 mm; at N = 20 / 31 it
 * is L ≈ 73.78 µm — the same resonance, different octaves.
 */

import {
  NAE_GAP_MIN,
  NAE_GAP_MAX,
  NAE_TARGET,
  COMPTON_PROTON,
  SPEED_OF_SOUND,
  KNOWN_LENR_ELEMENTS,
} from '../constants/naeConstants'

// Fundamental constants
export const COMPTON_ELECTRON = 2.42631e-12 // meters
const ELECTRON_PROTON_MASS_RATIO = 1836.15267

// Octave-gap (ΔN) search range
const MIN_OCTAVE = 7
const MAX_OCTAVE = 15

// Safety cap on ladder length (a band spanning 2^200 is not meaningful)
const MAX_LADDER_N = 200

export interface MullerResonancePair {
  Z1: number
  E1: string
  Z2: number
  E2: string
  mismatch: number // percentage
  deltaN: number // proton octave − electron octave
  electronElement: 'Z1' | 'Z2'
}

export interface MullerResonanceResult {
  selectedZ: number
  selectedSymbol: string
  pairs: MullerResonancePair[]
}

export interface ReactionOverlap {
  Z1: number
  E1: string
  Z2: number
  E2: string
  mismatch: number
  twoToTwoCount: number
  fusionCount: number
  avgMeV: number
  maxMeV: number
}

/** Result of the octave-independent resonance test between two elements. */
export interface MullerMatch {
  deltaN: number
  mismatchPct: number
  /** true when Z1 contributes the electron ladder and Z2 the proton ladder */
  electronIsZ1: boolean
}

/** One rung of a resonance ladder: electron octave N, proton octave N+ΔN, wavelength. */
export interface BandRung {
  N: number
  protonN: number
  wavelength: number // meters (electron-side L = Z_e · λe · 2^N)
}

/**
 * Find the best electron-proton resonance between two elements.
 *
 * Tests both orientations (Z1 electrons vs Z2 protons and vice versa) over
 * ΔN ∈ [MIN_OCTAVE, MAX_OCTAVE] and returns the best octave gap and its
 * mismatch. Returns null for invalid pairs or when the best mismatch > 100%.
 */
export function findResonance(Z1: number, Z2: number): MullerMatch | null {
  if (Z1 <= 0 || Z2 <= 0 || Z1 === Z2) return null

  let best = Infinity
  let bestDeltaN = 0
  let bestElectronIsZ1 = true

  for (let dN = MIN_OCTAVE; dN <= MAX_OCTAVE; dN++) {
    const idealRatio = Math.pow(2, dN) / ELECTRON_PROTON_MASS_RATIO

    // Z1 electron vs Z2 proton
    const mm = Math.abs(Z1 / Z2 - idealRatio) / idealRatio * 100
    if (mm < best) {
      best = mm
      bestDeltaN = dN
      bestElectronIsZ1 = true
    }

    // Z2 electron vs Z1 proton
    const mmReverse = Math.abs(Z2 / Z1 - idealRatio) / idealRatio * 100
    if (mmReverse < best) {
      best = mmReverse
      bestDeltaN = dN
      bestElectronIsZ1 = false
    }
  }

  if (best > 100) return null

  return { deltaN: bestDeltaN, mismatchPct: best, electronIsZ1: bestElectronIsZ1 }
}

/**
 * Place a resonance into a wavelength band.
 *
 * Returns every rung {N, protonN, wavelength} with N an integer ≥ 0 and
 * lambdaMin ≤ L ≤ lambdaMax, where L = zElectron · λe · 2^N. Consecutive
 * rungs double in wavelength. Returns [] for an empty or invalid band.
 */
export function placeInBand(
  match: Pick<MullerMatch, 'deltaN'>,
  zElectron: number,
  lambdaMin: number,
  lambdaMax: number
): BandRung[] {
  if (
    !(zElectron > 0) ||
    !Number.isFinite(lambdaMin) ||
    !Number.isFinite(lambdaMax) ||
    lambdaMin <= 0 ||
    lambdaMax < lambdaMin
  ) {
    return []
  }

  const base = zElectron * COMPTON_ELECTRON
  // Start one octave below the analytic estimate, then step up to absorb rounding.
  let N = Math.max(0, Math.floor(Math.log2(lambdaMin / base)) - 1)
  const rungs: BandRung[] = []

  for (; N <= MAX_LADDER_N; N++) {
    const L = base * Math.pow(2, N)
    if (L > lambdaMax) break
    if (L >= lambdaMin) {
      rungs.push({ N, protonN: N + match.deltaN, wavelength: L })
    }
  }

  return rungs
}

/** Z of the element contributing the electron ladder for a pair. */
export function electronZ(pair: Pick<MullerResonancePair, 'Z1' | 'Z2' | 'electronElement'>): number {
  return pair.electronElement === 'Z1' ? pair.Z1 : pair.Z2
}

// ============================================================================
// Wavelength band selection (URL state)
// ============================================================================

export type BandId = 'none' | 'um' | 'mm' | 'cm-m' | 'custom'

export interface BandSelection {
  band: BandId
  min: number // meters (ignored when band === 'none')
  max: number // meters
}

export const BAND_PRESETS: Record<Exclude<BandId, 'none' | 'custom'>, { min: number; max: number }> = {
  um: { min: 1e-6, max: 1e-3 },
  mm: { min: 1e-3, max: 1 },
  'cm-m': { min: 1e-2, max: 10 },
}

/** Default custom range when bmin/bmax are missing or invalid (1 mm – 1 m). */
export const DEFAULT_CUSTOM_BAND = { min: 1e-3, max: 1 }

/**
 * Parse band selection from URL search params:
 *   band=um|mm|cm-m|custom, bmin=<meters>, bmax=<meters> (custom only).
 * Unknown/missing band → 'none' (ratio only).
 */
export function parseBandParams(params: URLSearchParams): BandSelection {
  const band = params.get('band')
  if (band === 'um' || band === 'mm' || band === 'cm-m') {
    return { band, ...BAND_PRESETS[band] }
  }
  if (band === 'custom') {
    const rawMin = params.get('bmin')
    const rawMax = params.get('bmax')
    let min = rawMin === null || rawMin === '' ? NaN : Number(rawMin)
    let max = rawMax === null || rawMax === '' ? NaN : Number(rawMax)
    const valid = (x: number) => Number.isFinite(x) && x > 0
    if (!valid(min) || !valid(max)) {
      return { band: 'custom', ...DEFAULT_CUSTOM_BAND }
    }
    if (min > max) [min, max] = [max, min]
    return { band: 'custom', min, max }
  }
  return { band: 'none', min: 0, max: 0 }
}

/** Write band selection into URL search params (mutates and returns `params`). */
export function writeBandParams(params: URLSearchParams, sel: BandSelection): URLSearchParams {
  params.delete('band')
  params.delete('bmin')
  params.delete('bmax')
  if (sel.band === 'none') return params
  params.set('band', sel.band)
  if (sel.band === 'custom') {
    params.set('bmin', String(sel.min))
    params.set('bmax', String(sel.max))
  }
  return params
}

/**
 * Find all Muller-resonant partners for a given element.
 */
export function findResonantPartners(
  selectedZ: number,
  selectedSymbol: string,
  elements: Array<{ Z: number; E: string }>,
  threshold: number = 5.0
): MullerResonanceResult {
  const pairs: MullerResonancePair[] = []

  for (const el of elements) {
    if (el.Z === selectedZ || el.Z === 0) continue

    const match = findResonance(selectedZ, el.Z)
    if (!match || match.mismatchPct >= threshold) continue

    pairs.push({
      Z1: selectedZ,
      E1: selectedSymbol,
      Z2: el.Z,
      E2: el.E,
      mismatch: match.mismatchPct,
      deltaN: match.deltaN,
      electronElement: match.electronIsZ1 ? 'Z1' : 'Z2',
    })
  }

  pairs.sort((a, b) => a.mismatch - b.mismatch)

  return { selectedZ, selectedSymbol: selectedSymbol, pairs }
}

/**
 * Compute Muller mismatch for all element pairs (for the heatmap).
 * Returns a Map from "Z1-Z2" to mismatch percentage.
 */
export function computeAllPairMismatches(
  elements: Array<{ Z: number; E: string }>
): Map<string, number> {
  const map = new Map<string, number>()

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const z1 = elements[i].Z
      const z2 = elements[j].Z
      if (z1 === 0 || z2 === 0) continue

      const match = findResonance(z1, z2)
      if (match) {
        const key = `${Math.min(z1, z2)}-${Math.max(z1, z2)}`
        map.set(key, match.mismatchPct)
      }
    }
  }

  return map
}

/**
 * Compute the top global Muller-resonant pairs across all element combinations,
 * sorted by mismatch (best resonance first). Z1/E1 is always the electron side.
 */
export function computeTopGlobalPairs(
  elements: Array<{ Z: number; E: string }>,
  limit: number = 25
): MullerResonancePair[] {
  const pairs: MullerResonancePair[] = []

  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const z1 = elements[i].Z
      const z2 = elements[j].Z
      if (z1 === 0 || z2 === 0) continue

      const match = findResonance(z1, z2)
      if (match) {
        pairs.push({
          Z1: match.electronIsZ1 ? z1 : z2,
          E1: match.electronIsZ1 ? elements[i].E : elements[j].E,
          Z2: match.electronIsZ1 ? z2 : z1,
          E2: match.electronIsZ1 ? elements[j].E : elements[i].E,
          mismatch: match.mismatchPct,
          deltaN: match.deltaN,
          electronElement: 'Z1',
        })
      }
    }
  }

  pairs.sort((a, b) => a.mismatch - b.mismatch)
  return pairs.slice(0, limit)
}

/**
 * Query the database for reaction counts between Muller-resonant pairs.
 */
export function queryResonantReactions(
  db: import('sql.js').Database,
  pairs: MullerResonancePair[]
): ReactionOverlap[] {
  if (pairs.length === 0) return []

  // Build a pair key for lookup: "minZ:maxZ"
  const pairKey = (z1: number, z2: number) => `${Math.min(z1, z2)}:${Math.max(z1, z2)}`

  // Collect unique Z values across all pairs for batch queries
  const allZ = new Set<number>()
  for (const p of pairs) { allZ.add(p.Z1); allZ.add(p.Z2) }
  const zList = Array.from(allZ).join(',')

  // Single query for TwoToTwoAll — filter to relevant Z values, then group by pair
  const tttResult = db.exec(
    `SELECT
      CASE WHEN Z1 <= Z2 THEN Z1 ELSE Z2 END AS Za,
      CASE WHEN Z1 <= Z2 THEN Z2 ELSE Z1 END AS Zb,
      COUNT(*), COALESCE(AVG(MeV), 0), COALESCE(MAX(MeV), 0)
     FROM TwoToTwoAll
     WHERE Z1 IN (${zList}) AND Z2 IN (${zList})
     GROUP BY Za, Zb`
  )

  // Single query for FusionAll
  const fusResult = db.exec(
    `SELECT
      CASE WHEN Z1 <= Z2 THEN Z1 ELSE Z2 END AS Za,
      CASE WHEN Z1 <= Z2 THEN Z2 ELSE Z1 END AS Zb,
      COUNT(*)
     FROM FusionAll
     WHERE Z1 IN (${zList}) AND Z2 IN (${zList})
     GROUP BY Za, Zb`
  )

  // Index results by pair key
  const tttMap = new Map<string, [number, number, number]>()
  if (tttResult[0]) {
    for (const row of tttResult[0].values) {
      tttMap.set(`${row[0]}:${row[1]}`, [Number(row[2]), Number(row[3]), Number(row[4])])
    }
  }

  const fusMap = new Map<string, number>()
  if (fusResult[0]) {
    for (const row of fusResult[0].values) {
      fusMap.set(`${row[0]}:${row[1]}`, Number(row[2]))
    }
  }

  return pairs.map(pair => {
    const key = pairKey(pair.Z1, pair.Z2)
    const ttt = tttMap.get(key) || [0, 0, 0]
    const fus = fusMap.get(key) || 0

    return {
      Z1: pair.Z1,
      E1: pair.E1,
      Z2: pair.Z2,
      E2: pair.E2,
      mismatch: pair.mismatch,
      twoToTwoCount: ttt[0],
      fusionCount: fus,
      avgMeV: ttt[1],
      maxMeV: ttt[2],
    }
  }).sort((a, b) => a.mismatch - b.mismatch)
}

/**
 * Format wavelength for display.
 */
export function formatWavelength(meters: number): string {
  if (meters >= 1) return `${meters.toFixed(2)} m`
  if (meters >= 0.001) return `${(meters * 1000).toFixed(2)} mm`
  if (meters >= 1e-6) return `${(meters * 1e6).toFixed(2)} µm`
  if (meters >= 1e-9) return `${(meters * 1e9).toFixed(2)} nm`
  return `${(meters * 1e12).toFixed(2)} pm`
}

/**
 * Get resonance quality label.
 */
export function getResonanceQuality(mismatch: number): 'exact' | 'strong' | 'moderate' | 'weak' {
  if (mismatch < 0.01) return 'exact'
  if (mismatch < 0.5) return 'strong'
  if (mismatch < 2.0) return 'moderate'
  return 'weak'
}

// ============================================================================
// NAE Lattice Predictions
// ============================================================================

export interface OctaveResonance {
  N: number
  L: number // meters
}

export interface NAEPrediction {
  Z: number
  E: string
  electronResonances: OctaveResonance[] // N=1..10
  naeOctave: number | null // which N falls in NAE range
  naeWavelength: number | null // L at that N (meters)
  naeScore: number // |log2(L/1nm)|, lower = better
  deuteriumOverlapN: number | null
  deuteriumOverlapL: number | null
  deuteriumMismatch: number | null // % mismatch between host electron and D proton
  phononFrequency: number | null // Hz
  speedOfSound: number | null // m/s
  lenrStrength: 'strong' | 'moderate' | 'weak' | null
  lenrReference: string | null
}

/**
 * Compute electron resonance wavelength for an element at a given octave.
 */
export function electronResonance(Z: number, N: number): number {
  return Z * COMPTON_ELECTRON * Math.pow(2, N)
}

/**
 * Compute proton resonance wavelength for Z protons at a given octave.
 */
export function protonResonance(Z: number, N: number): number {
  return Z * COMPTON_PROTON * Math.pow(2, N)
}

/**
 * Compute NAE lattice predictions for all elements.
 * Identifies which elements have electron resonance wavelengths
 * near the ~1 nm NAE gap identified by Storms.
 */
export function computeNAEPredictions(
  elements: Array<{ Z: number; E: string }>
): NAEPrediction[] {
  const predictions: NAEPrediction[] = []

  for (const el of elements) {
    if (el.Z === 0) continue

    // Compute electron resonances for N=1..10
    const electronRes: OctaveResonance[] = []
    let bestNaeOctave: number | null = null
    let bestNaeWavelength: number | null = null
    let bestNaeScore = Infinity

    for (let N = 1; N <= 10; N++) {
      const L = electronResonance(el.Z, N)
      electronRes.push({ N, L })

      // Check if this falls in NAE range
      if (L >= NAE_GAP_MIN && L <= NAE_GAP_MAX) {
        const score = Math.abs(Math.log2(L / NAE_TARGET))
        if (score < bestNaeScore) {
          bestNaeScore = score
          bestNaeOctave = N
          bestNaeWavelength = L
        }
      }
    }

    // If no octave falls exactly in range, find closest N=3 or N=4
    if (bestNaeOctave === null) {
      for (const N of [3, 4, 5, 2]) {
        const L = electronResonance(el.Z, N)
        const score = Math.abs(Math.log2(L / NAE_TARGET))
        if (score < bestNaeScore) {
          bestNaeScore = score
          bestNaeOctave = N
          bestNaeWavelength = L
        }
      }
    }

    // Find deuterium proton resonance overlap
    let bestDOverlapN: number | null = null
    let bestDOverlapL: number | null = null
    let bestDMismatch: number | null = null

    if (bestNaeWavelength !== null) {
      let bestDDistance = Infinity
      for (let N = 1; N <= 30; N++) {
        // Muller's equation uses Z (atomic number), not A (mass number).
        // Deuterium has Z=1 (same as protium). The proton Compton wavelength
        // is the fundamental constant in L = Z × C_p × 2^N, not particle-specific.
        const L_D = protonResonance(1, N)
        const distance = Math.abs(L_D - bestNaeWavelength)
        if (distance < bestDDistance) {
          bestDDistance = distance
          bestDOverlapN = N
          bestDOverlapL = L_D
          bestDMismatch = (distance / bestNaeWavelength) * 100
        }
      }
    }

    // Speed of sound and phonon frequency
    const sos = SPEED_OF_SOUND[el.E] ?? null
    let phononFreq: number | null = null
    if (sos !== null && bestNaeWavelength !== null && bestNaeWavelength > 0) {
      phononFreq = sos / bestNaeWavelength
    }

    // Known LENR status
    const lenrData = KNOWN_LENR_ELEMENTS[el.E]

    predictions.push({
      Z: el.Z,
      E: el.E,
      electronResonances: electronRes,
      naeOctave: bestNaeOctave,
      naeWavelength: bestNaeWavelength,
      naeScore: bestNaeScore,
      deuteriumOverlapN: bestDOverlapN,
      deuteriumOverlapL: bestDOverlapL,
      deuteriumMismatch: bestDMismatch,
      phononFrequency: phononFreq,
      speedOfSound: sos,
      lenrStrength: lenrData?.strength ?? null,
      lenrReference: lenrData?.reference ?? null,
    })
  }

  // Sort by NAE score (best first)
  predictions.sort((a, b) => a.naeScore - b.naeScore)

  return predictions
}

/**
 * Get NAE prediction quality based on how close the wavelength is to 1 nm.
 */
export function getNAEQuality(naeScore: number, inRange: boolean): 'optimal' | 'good' | 'marginal' | 'distant' {
  if (inRange && naeScore < 0.3) return 'optimal'
  if (inRange) return 'good'
  if (naeScore < 1.5) return 'marginal'
  return 'distant'
}

/**
 * Format frequency for display.
 */
export function formatFrequency(hz: number): string {
  if (hz >= 1e12) return `${(hz / 1e12).toFixed(1)} THz`
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(1)} GHz`
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(1)} MHz`
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`
  return `${hz.toFixed(0)} Hz`
}

/**
 * Query total Parkhomov reaction counts for individual elements.
 * Returns a map from Z to total reaction count (fusion + fission + two-to-two as input).
 */
export function queryElementReactionCounts(
  db: import('sql.js').Database
): Map<number, number> {
  const map = new Map<number, number>()

  const result = db.exec(
    `SELECT Z, SUM(cnt) AS total FROM (
      SELECT Z1 AS Z, COUNT(*) AS cnt FROM FusionAll GROUP BY Z1
      UNION ALL SELECT Z2 AS Z, COUNT(*) AS cnt FROM FusionAll GROUP BY Z2
      UNION ALL SELECT Z1 AS Z, COUNT(*) AS cnt FROM FissionAll GROUP BY Z1
      UNION ALL SELECT Z1 AS Z, COUNT(*) AS cnt FROM TwoToTwoAll GROUP BY Z1
      UNION ALL SELECT Z2 AS Z, COUNT(*) AS cnt FROM TwoToTwoAll GROUP BY Z2
    ) GROUP BY Z`
  )

  if (result[0]) {
    for (const row of result[0].values) {
      map.set(Number(row[0]), Number(row[1]) || 0)
    }
  }

  return map
}
