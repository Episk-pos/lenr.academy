/**
 * Decay Chain Service
 *
 * Provides functions for tracing multi-generation radioactive decay chains.
 * Uses the RadioNuclides table to recursively build decay trees showing
 * how unstable isotopes transform through successive decays.
 */

import type { Database } from 'sql.js'
import type { DecayChainNode, DecayChainResult, DecayData } from '../types'
import { getRadioactiveDecayData, getElementSymbolByZ, getNuclideHalfLives, STABLE_LHL_SENTINEL, type NuclideHalfLife } from './queryService'

/**
 * Calculate daughter nuclide from decay mode
 *
 * @param Z - Atomic number of parent
 * @param A - Mass number of parent
 * @param E - Element symbol of parent
 * @param decayMode - Decay mode (A, B-, B+, EC, IT, etc.)
 * @returns Daughter nuclide coordinates or null if decay mode not recognized
 */
export function getDaughterNuclide(
  Z: number,
  A: number,
  E: string,
  decayMode: string
): { Z: number; A: number; E: string } | null {
  const mode = decayMode.toUpperCase()

  // Alpha decay: Z-2, A-4
  if (mode.includes('A') && !mode.includes('EC') && !mode.includes('B')) {
    return { Z: Z - 2, A: A - 4, E: '' } // Element symbol needs lookup
  }

  // Beta minus decay: Z+1, A stays same
  if (mode.includes('B-') || mode.includes('β-')) {
    return { Z: Z + 1, A: A, E: '' }
  }

  // Beta plus decay: Z-1, A stays same
  if (mode.includes('B+') || mode.includes('β+')) {
    return { Z: Z - 1, A: A, E: '' }
  }

  // Electron capture: Z-1, A stays same
  if (mode.includes('EC')) {
    return { Z: Z - 1, A: A, E: '' }
  }

  // Isomeric transition: same nuclide, just energy state change
  if (mode.includes('IT')) {
    return { Z: Z, A: A, E: E }
  }

  return null
}

/**
 * Look up NuclidesPlus.LHL by (Z, A).
 *
 * Keyed on Z/A rather than the element symbol because NuclidesPlus stores the
 * hydrogen isotopes as 'H' / 'D' / 'T' while ElementPropertiesPlus maps Z=1 to 'H'.
 *
 * @returns `undefined` when the nuclide has no NuclidesPlus row, otherwise its LHL (may be null)
 */
function getNuclidesPlusLHL(db: Database, Z: number, A: number): number | null | undefined {
  const results = db.exec(`SELECT LHL FROM NuclidesPlus WHERE Z = ? AND A = ? LIMIT 1`, [Z, A])
  if (results.length === 0 || results[0].values.length === 0) {
    return undefined
  }
  const lhl = results[0].values[0][0]
  return typeof lhl === 'number' ? lhl : null
}

/**
 * Ground-state half-life and stability of a nuclide.
 *
 * Uses the same radioactivity predicate as the rest of the app
 * (getRadioactiveNuclides / getNuclideHalfLives): a nuclide is radioactive iff
 * it has a ground-state RadioNuclides row, i.e. one matching its NuclidesPlus
 * LHL, or any RadioNuclides row when it has no NuclidesPlus entry (e.g. Ra-224,
 * Pb-212). Long-lived nuclides such as U-238 are radioactive; stable nuclides
 * with only isomer rows (Ba-137m) are not.
 *
 * Without a ground-state row, a nuclide is stable if its NuclidesPlus LHL > 9
 * (stable, or so long-lived it is effectively stable). When stability cannot
 * be determined (no RadioNuclides rows and no NuclidesPlus half-life), the
 * nuclide is NOT reported as stable.
 *
 * @param db - SQLite database
 * @param Z - Atomic number
 * @param A - Mass number
 */
function getNuclideStability(
  db: Database,
  Z: number,
  A: number
): {
  isStable: boolean
  stabilityUnknown: boolean
  halfLife?: NuclideHalfLife
  nuclidesPlusLHL: number | null | undefined
} {
  const nuclidesPlusLHL = getNuclidesPlusLHL(db, Z, A)
  const halfLife = getNuclideHalfLives(db, [{ Z, A, logHalfLife: nuclidesPlusLHL }]).get(`${Z}-${A}`)

  if (halfLife) {
    return { isStable: false, stabilityUnknown: false, halfLife, nuclidesPlusLHL }
  }

  if (typeof nuclidesPlusLHL === 'number') {
    return { isStable: nuclidesPlusLHL > 9, stabilityUnknown: false, nuclidesPlusLHL }
  }

  // No NuclidesPlus half-life and (since getNuclideHalfLives falls back to any
  // row in that case) no RadioNuclides rows either: stability unknown
  return { isStable: false, stabilityUnknown: true, nuclidesPlusLHL }
}

/**
 * Check if a nuclide is stable (see getNuclideStability)
 *
 * @returns true if stable, false if radioactive or unknown
 */
function isNuclideStable(db: Database, Z: number, A: number): boolean {
  return getNuclideStability(db, Z, A).isStable
}

/**
 * Trace a radioactive decay chain recursively
 *
 * Builds a tree structure showing multi-generation decay sequences.
 * Handles branching decay paths (nuclides with multiple decay modes).
 *
 * @param db - SQLite database
 * @param Z - Starting atomic number
 * @param A - Starting mass number
 * @param options - Configuration options
 * @param options.maxDepth - Maximum generations to trace (default: 10)
 * @param options.minBranchingRatio - Minimum intensity % to include (default: 1.0)
 * @returns DecayChainResult with root node and metadata
 */
export function traceDecayChain(
  db: Database,
  Z: number,
  A: number,
  options: {
    maxDepth?: number
    minBranchingRatio?: number
  } = {}
): DecayChainResult {
  const maxDepth = options.maxDepth ?? 10
  const minBranchingRatio = options.minBranchingRatio ?? 1.0

  // Track visited nuclides to prevent infinite loops (e.g., isomeric transitions)
  const visited = new Set<string>()

  // Track branching points (nuclides with 2+ followed decay modes) and
  // unique terminal nuclides (several paths may end at the same nuclide)
  let branchCount = 0
  const terminalNuclides: DecayChainResult['terminalNuclides'] = []
  const terminalKeys = new Set<string>()

  /**
   * Recursive helper to build decay tree
   */
  function buildNode(
    currentZ: number,
    currentA: number,
    depth: number,
    parentDecayMode?: string,
    parentBranchingRatio?: number
  ): DecayChainNode | null {
    // Generate unique key for this nuclide
    const key = `${currentZ}-${currentA}`

    // Stop conditions
    if (depth > maxDepth) {
      return null
    }

    // Stability and this nuclide's own ground-state half-life (RadioNuclides
    // fallback covers nuclides without a NuclidesPlus row)
    const { isStable, stabilityUnknown, halfLife: halfLifeRecord, nuclidesPlusLHL } = getNuclideStability(db, currentZ, currentA)

    // Get element symbol
    const E = getElementSymbolByZ(db, currentZ)
    if (!E) {
      return null // Invalid atomic number
    }

    // Get decay data
    const decayData = getRadioactiveDecayData(db, currentZ, currentA)

    // Create node
    const node: DecayChainNode = {
      nuclide: { Z: currentZ, A: currentA, E },
      decayMode: parentDecayMode,
      branchingRatio: parentBranchingRatio,
      halfLife: halfLifeRecord?.halfLife ?? undefined,
      halfLifeUnits: halfLifeRecord?.units ?? undefined,
      logHalfLife: halfLifeRecord?.logHalfLife
        ?? (typeof nuclidesPlusLHL === 'number' && nuclidesPlusLHL < STABLE_LHL_SENTINEL ? nuclidesPlusLHL : undefined),
      children: [],
      depth,
      isStable,
      ...(stabilityUnknown && { stabilityUnknown })
    }

    // If this is a leaf node (stable or max depth reached), record it
    if (isStable || decayData.length === 0 || depth >= maxDepth) {
      if (terminalKeys.has(key)) {
        return node
      }
      terminalKeys.add(key)
      terminalNuclides.push({
        Z: currentZ,
        A: currentA,
        E,
        isStable,
        ...(stabilityUnknown && { stabilityUnknown })
      })
      return node
    }

    // Prevent cycles (e.g., IT loops)
    if (visited.has(key)) {
      return node
    }
    visited.add(key)

    // Group decay data by unique decay modes
    // Calculate total intensity per decay mode by summing all radiation types
    const decayModeMap = new Map<string, DecayData[]>()
    decayData.forEach(decay => {
      if (!decayModeMap.has(decay.decayMode)) {
        decayModeMap.set(decay.decayMode, [])
      }
      decayModeMap.get(decay.decayMode)!.push(decay)
    })

    // Calculate branching ratios for each decay mode
    const decayModeIntensities = new Map<string, number>()
    decayModeMap.forEach((decays, mode) => {
      // Use the maximum intensity as the branching ratio for this mode
      // (since multiple radiation types can be emitted per decay)
      const maxIntensity = Math.max(...decays.map(d => d.intensity ?? 0))
      decayModeIntensities.set(mode, maxIntensity)
    })

    // Normalize branching ratios so they sum to 100%
    const totalIntensity = Array.from(decayModeIntensities.values()).reduce((sum, i) => sum + i, 0)
    const normalizedIntensities = new Map<string, number>()
    decayModeIntensities.forEach((intensity, mode) => {
      normalizedIntensities.set(mode, totalIntensity > 0 ? (intensity / totalIntensity) * 100 : 0)
    })

    // Process each decay mode above the minimum branching ratio
    let followedModes = 0
    normalizedIntensities.forEach((branchingRatio, decayMode) => {
      if (branchingRatio < minBranchingRatio) {
        return // Skip low-probability branches
      }

      // Calculate daughter nuclide
      const daughter = getDaughterNuclide(currentZ, currentA, E, decayMode)
      if (!daughter) {
        return // Unrecognized decay mode
      }

      // Get element symbol for daughter if not provided
      const daughterE = daughter.E || getElementSymbolByZ(db, daughter.Z)
      if (!daughterE) {
        return // Invalid daughter
      }

      followedModes++

      // Recursively build child node
      const childNode = buildNode(
        daughter.Z,
        daughter.A,
        depth + 1,
        decayMode,
        branchingRatio
      )

      if (childNode) {
        node.children.push(childNode)
      }
    })

    // A branching point is a nuclide with two or more followed decay modes
    if (followedModes >= 2) {
      branchCount++
    }

    return node
  }

  // Build the tree starting from the root
  const root = buildNode(Z, A, 0)

  if (!root) {
    // Failed to build tree (shouldn't happen for valid input)
    return {
      root: {
        nuclide: { Z, A, E: getElementSymbolByZ(db, Z) ?? '?' },
        children: [],
        depth: 0,
        isStable: false
      },
      totalGenerations: 0,
      branchCount: 0,
      terminalNuclides: []
    }
  }

  // Calculate total generations
  let maxDepthFound = 0
  function findMaxDepth(node: DecayChainNode) {
    maxDepthFound = Math.max(maxDepthFound, node.depth)
    node.children.forEach(findMaxDepth)
  }
  findMaxDepth(root)

  return {
    root,
    totalGenerations: maxDepthFound,
    branchCount,
    terminalNuclides
  }
}

/**
 * Get a simple linear decay chain (follows only the primary decay mode)
 *
 * This is a simplified version that doesn't show branching, useful for
 * compact displays or educational purposes.
 *
 * @param db - SQLite database
 * @param Z - Starting atomic number
 * @param A - Starting mass number
 * @param maxSteps - Maximum steps to trace (default: 20)
 * @returns Array of nuclides in the decay sequence
 */
export function getLinearDecayChain(
  db: Database,
  Z: number,
  A: number,
  maxSteps: number = 20
): Array<{ Z: number; A: number; E: string; decayMode?: string }> {
  const chain: Array<{ Z: number; A: number; E: string; decayMode?: string }> = []
  const visited = new Set<string>()

  let currentZ = Z
  let currentA = A

  for (let step = 0; step < maxSteps; step++) {
    const key = `${currentZ}-${currentA}`
    if (visited.has(key)) {
      break // Prevent infinite loops
    }
    visited.add(key)

    // Get element symbol
    const E = getElementSymbolByZ(db, currentZ)
    if (!E) break

    // Add current nuclide to chain
    chain.push({ Z: currentZ, A: currentA, E })

    // Check if stable
    if (isNuclideStable(db, currentZ, currentA)) {
      break
    }

    // Get decay data
    const decayData = getRadioactiveDecayData(db, currentZ, currentA)
    if (decayData.length === 0) {
      break // No decay modes
    }

    // Get primary decay mode (highest intensity)
    const primaryDecay = decayData.reduce((max, d) =>
      (d.intensity ?? 0) > (max.intensity ?? 0) ? d : max
    , decayData[0])

    // Calculate daughter
    const daughter = getDaughterNuclide(currentZ, currentA, E, primaryDecay.decayMode)
    if (!daughter) {
      break // Unrecognized decay mode
    }

    // Update last chain entry with decay mode
    chain[chain.length - 1].decayMode = primaryDecay.decayMode

    // Move to daughter
    currentZ = daughter.Z
    currentA = daughter.A
  }

  return chain
}
