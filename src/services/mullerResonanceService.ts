/**
 * Muller Resonance Service
 *
 * Implements Frithjof Muller's equation: L = Z × C × 2^N
 * where L is the resonance wavelength, Z is atomic number,
 * C is the Compton wavelength (electron or proton), and N is the octave number.
 *
 * When an element's electron resonance wavelength matches another element's
 * proton resonance wavelength at exact integer octave numbers, they share
 * a cross-particle resonance. Only ~0.2% of all element pairs match
 * to < 0.01%.
 *
 * Example: Copper (Z=29) electrons at N=31 and Iron (Z=26) protons at N=42
 * both produce L = 151.1 mm — a match to 0.0008%.
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
const COMPTON_ELECTRON = 2.42631e-12 // meters
const ELECTRON_PROTON_MASS_RATIO = 1836.15267

// Octave search range
const MIN_OCTAVE = 7
const MAX_OCTAVE = 15

export interface MullerResonancePair {
  Z1: number
  E1: string
  Z2: number
  E2: string
  mismatch: number // percentage
  wavelength: number // meters
  electronOctave: number
  protonOctave: number
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

/**
 * Compute the best electron-proton resonance mismatch between two elements.
 * Returns the mismatch percentage and octave numbers.
 */
export function computeMullerMismatch(
  Z1: number,
  Z2: number
): { mismatch: number; electronOctave: number; protonOctave: number; wavelength: number; electronIsZ1: boolean } | null {
  if (Z1 === 0 || Z2 === 0 || Z1 === Z2) return null

  let best = 999
  let bestElectronN = 0
  let bestProtonN = 0
  let bestWavelength = 0
  let bestElectronIsZ1 = true

  // Check Z1 electron vs Z2 proton
  for (let dN = MIN_OCTAVE; dN <= MAX_OCTAVE; dN++) {
    const idealRatio = Math.pow(2, dN) / ELECTRON_PROTON_MASS_RATIO
    const actualRatio = Z1 / Z2
    const mm = Math.abs(actualRatio - idealRatio) / idealRatio * 100
    if (mm < best) {
      best = mm
      // Find actual octave numbers that produce a reasonable wavelength
      for (let N1 = 20; N1 <= 40; N1++) {
        const L = Z1 * COMPTON_ELECTRON * Math.pow(2, N1)
        if (L > 1e-6 && L < 10) {
          bestElectronN = N1
          bestProtonN = N1 + dN
          bestWavelength = L
          bestElectronIsZ1 = true
          break
        }
      }
    }

    // Check Z2 electron vs Z1 proton
    const reverseRatio = Z2 / Z1
    const mmReverse = Math.abs(reverseRatio - idealRatio) / idealRatio * 100
    if (mmReverse < best) {
      best = mmReverse
      for (let N1 = 20; N1 <= 40; N1++) {
        const L = Z2 * COMPTON_ELECTRON * Math.pow(2, N1)
        if (L > 1e-6 && L < 10) {
          bestElectronN = N1
          bestProtonN = N1 + dN
          bestWavelength = L
          bestElectronIsZ1 = false
          break
        }
      }
    }
  }

  if (best > 100) return null

  return {
    mismatch: best,
    electronOctave: bestElectronN,
    protonOctave: bestProtonN,
    wavelength: bestWavelength,
    electronIsZ1: bestElectronIsZ1,
  }
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

    const result = computeMullerMismatch(selectedZ, el.Z)
    if (!result || result.mismatch >= threshold) continue

    pairs.push({
      Z1: selectedZ,
      E1: selectedSymbol,
      Z2: el.Z,
      E2: el.E,
      mismatch: result.mismatch,
      wavelength: result.wavelength,
      electronOctave: result.electronOctave,
      protonOctave: result.protonOctave,
      electronElement: result.electronIsZ1 ? 'Z1' : 'Z2',
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

      const result = computeMullerMismatch(z1, z2)
      if (result) {
        const key = `${Math.min(z1, z2)}-${Math.max(z1, z2)}`
        map.set(key, result.mismatch)
      }
    }
  }

  return map
}

/**
 * Compute the top global Muller-resonant pairs across all element combinations,
 * sorted by mismatch (best resonance first).
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

      const result = computeMullerMismatch(z1, z2)
      if (result) {
        pairs.push({
          Z1: result.electronIsZ1 ? z1 : z2,
          E1: result.electronIsZ1 ? elements[i].E : elements[j].E,
          Z2: result.electronIsZ1 ? z2 : z1,
          E2: result.electronIsZ1 ? elements[j].E : elements[i].E,
          mismatch: result.mismatch,
          wavelength: result.wavelength,
          electronOctave: result.electronOctave,
          protonOctave: result.protonOctave,
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
  if (meters >= 1e-6) return `${(meters * 1e6).toFixed(2)} μm`
  return `${(meters * 1e9).toFixed(2)} nm`
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
