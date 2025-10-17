/**
 * Decay Chain Service
 *
 * Provides functions for tracing multi-generation radioactive decay chains.
 * Uses the RadioNuclides table to recursively build decay trees showing
 * how unstable isotopes transform through successive decays.
 */

import type { Database } from 'sql.js'
import type { DecayChainNode, DecayChainResult, DecayData } from '../types'
import { getRadioactiveDecayData, getElementSymbolByZ, getNuclideBySymbol } from './queryService'

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
 * Check if a nuclide is stable
 *
 * A nuclide is considered stable if:
 * 1. It has NO decay data in RadioNuclides table (truly stable)
 * 2. OR it has logHalfLife > 9 AND no decay data (very long-lived, effectively stable)
 *
 * @param db - SQLite database
 * @param Z - Atomic number
 * @param A - Mass number
 * @returns true if stable, false if radioactive
 */
function isNuclideStable(db: Database, Z: number, A: number): boolean {
  // First check if it has decay data in RadioNuclides
  const radioSql = `SELECT COUNT(*) FROM RadioNuclides WHERE Z = ? AND A = ?`
  const radioResults = db.exec(radioSql, [Z, A])
  const hasDecayData = radioResults.length > 0 && (radioResults[0].values[0][0] as number) > 0

  // If it has decay data, it's radioactive (even if long-lived like U-238)
  if (hasDecayData) {
    return false
  }

  // No decay data, check NuclidesPlus for logHalfLife
  const sql = `
    SELECT LHL
    FROM NuclidesPlus
    WHERE Z = ? AND A = ?
    LIMIT 1
  `
  const results = db.exec(sql, [Z, A])

  if (results.length === 0 || results[0].values.length === 0) {
    return true // Not found anywhere, assume stable
  }

  const logHalfLife = results[0].values[0][0] as number | null
  if (logHalfLife === null || logHalfLife === undefined) {
    return true // No half-life data, assume stable
  }

  // Very long-lived (> 1 billion years) with no decay data = effectively stable
  return logHalfLife > 9
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

  // Track branch count and terminal nuclides
  let branchCount = 0
  const terminalNuclides: Array<{ Z: number; A: number; E: string; isStable: boolean }> = []

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

    // Check if nuclide is stable
    const isStable = isNuclideStable(db, currentZ, currentA)

    // Get element symbol
    const E = getElementSymbolByZ(db, currentZ)
    if (!E) {
      return null // Invalid atomic number
    }

    // Get decay data
    const decayData = getRadioactiveDecayData(db, currentZ, currentA)

    // Get log half-life from NuclidesPlus
    const nuclide = getNuclideBySymbol(db, E, currentA)
    const logHalfLife = nuclide?.logHalfLife ?? null

    // Create node
    const node: DecayChainNode = {
      nuclide: { Z: currentZ, A: currentA, E },
      decayMode: parentDecayMode,
      branchingRatio: parentBranchingRatio,
      halfLife: undefined,
      halfLifeUnits: undefined,
      logHalfLife: logHalfLife ?? undefined,
      children: [],
      depth,
      isStable
    }

    // If this is a leaf node (stable or max depth reached), record it
    if (isStable || decayData.length === 0 || depth >= maxDepth) {
      terminalNuclides.push({
        Z: currentZ,
        A: currentA,
        E,
        isStable
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
    normalizedIntensities.forEach((branchingRatio, decayMode) => {
      if (branchingRatio < minBranchingRatio) {
        return // Skip low-probability branches
      }

      branchCount++

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

      // Get decay data for this specific mode to extract half-life
      const modeDecays = decayModeMap.get(decayMode) ?? []
      const primaryDecay = modeDecays.find(d => d.halfLife !== null) ?? modeDecays[0]

      // Recursively build child node
      const childNode = buildNode(
        daughter.Z,
        daughter.A,
        depth + 1,
        decayMode,
        branchingRatio
      )

      if (childNode) {
        // Add half-life info from parent's decay data
        childNode.halfLife = primaryDecay?.halfLife ?? undefined
        childNode.halfLifeUnits = primaryDecay?.halfLifeUnits ?? undefined
        node.children.push(childNode)
      }
    })

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
        isStable: true
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
