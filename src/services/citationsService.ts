// Citation lookup helpers for the annotated bibliography overlay (#173).
//
// All lookups are pure, in-memory, and case-tolerant. They operate on the
// curated dataset in src/data/citations.ts. Three primary entry points:
//
//   - getCitationsForReaction(...)     — match by reactionKey
//   - getCitationsForTransmutation(...) — match by element-level transmutation
//   - getCitationsForElement(Z)        — match either side of any transmutation
//
// Reaction key format: alphabetized "<input>+<input>-><output>(+<output>)?"
// using element symbol + mass number. Example: "D-2+D-2->He-4".

import { citations, citationById } from '../data/citations'
import type { Citation } from '../types/citations'

/**
 * Map of common hydrogen-isotope aliases to canonical form.
 * The Parkhomov DB stores hydrogen isotopes as "H" (protium), "D" (deuterium),
 * "T" (tritium); citations may also use "1H", "2H", "3H".
 */
const HYDROGEN_ALIASES: Record<string, { symbol: string; A: number }> = {
  H: { symbol: 'H', A: 1 },
  H1: { symbol: 'H', A: 1 },
  '1H': { symbol: 'H', A: 1 },
  D: { symbol: 'D', A: 2 },
  D2: { symbol: 'D', A: 2 },
  '2H': { symbol: 'D', A: 2 },
  T: { symbol: 'T', A: 3 },
  T3: { symbol: 'T', A: 3 },
  '3H': { symbol: 'T', A: 3 },
}

/** Normalize a single nuclide token like "d-2", "2H", "He-4" to canonical "D-2"/"He-4". */
export function normalizeNuclideToken(token: string): string {
  if (!token) return ''
  const trimmed = token.trim()
  // Try patterns: "X-A", "X A", "AX" (e.g. "2H"), or bare element
  const dashed = trimmed.match(/^([A-Za-z]+)-?(\d+)?$/)
  const leadingMass = trimmed.match(/^(\d+)([A-Za-z]+)$/)

  let rawSymbol = ''
  let rawMass: string | undefined
  if (leadingMass) {
    rawMass = leadingMass[1]
    rawSymbol = leadingMass[2]
  } else if (dashed) {
    rawSymbol = dashed[1]
    rawMass = dashed[2]
  } else {
    return trimmed
  }

  // Title-case multi-letter symbols (he -> He), preserve "D"/"T".
  const symbol =
    rawSymbol.length === 1
      ? rawSymbol.toUpperCase()
      : rawSymbol[0].toUpperCase() + rawSymbol.slice(1).toLowerCase()

  // Apply hydrogen-isotope alias resolution (e.g. "1H" -> "H-1", "2H" -> "D-2").
  if (rawMass) {
    const aliasKey = `${rawMass}${symbol}`
    if (aliasKey in HYDROGEN_ALIASES) {
      const alias = HYDROGEN_ALIASES[aliasKey]
      return `${alias.symbol}-${alias.A}`
    }
  }
  if (symbol in HYDROGEN_ALIASES && rawMass) {
    const alias = HYDROGEN_ALIASES[symbol]
    if (alias.A === parseInt(rawMass, 10)) {
      return `${alias.symbol}-${alias.A}`
    }
  }

  return rawMass ? `${symbol}-${rawMass}` : symbol
}

/** Canonicalize a reactionKey by normalizing and alphabetizing each side. */
export function canonicalizeReactionKey(key: string): string {
  if (!key) return ''
  const sides = key.split('->')
  if (sides.length !== 2) return ''
  const [lhs, rhs] = sides

  const normalizeSide = (side: string) =>
    side
      .split('+')
      .map((t) => normalizeNuclideToken(t))
      .filter(Boolean)
      .sort()
      .join('+')

  return `${normalizeSide(lhs)}->${normalizeSide(rhs)}`
}

/**
 * Build a canonical reaction key from individual nuclide identifiers.
 * Each `input` and `output` may be in any case ("d-2"/"D-2"/"2H"); the
 * result is canonical (alphabetized + normalized).
 */
export function buildReactionKey(
  inputs: Array<{ symbol: string; A?: number } | string>,
  outputs: Array<{ symbol: string; A?: number } | string>
): string {
  const tokenize = (entry: { symbol: string; A?: number } | string) => {
    if (typeof entry === 'string') return normalizeNuclideToken(entry)
    if (entry.A == null) return normalizeNuclideToken(entry.symbol)
    return normalizeNuclideToken(`${entry.symbol}-${entry.A}`)
  }
  const lhs = inputs.map(tokenize).filter(Boolean).sort().join('+')
  const rhs = outputs.map(tokenize).filter(Boolean).sort().join('+')
  return `${lhs}->${rhs}`
}

/**
 * Find citations whose `reactionKey` matches the given inputs/outputs.
 * Inputs may be supplied as objects (`{symbol, A}`) or canonical strings.
 *
 * For one-output reactions, pass a single output. For two-to-two, pass two.
 */
export function getCitationsForReaction(
  input1: { symbol: string; A?: number } | string,
  input2: { symbol: string; A?: number } | string,
  output1: { symbol: string; A?: number } | string,
  output2?: { symbol: string; A?: number } | string
): Citation[] {
  const inputs = [input1, input2]
  const outputs = output2 != null ? [output1, output2] : [output1]
  const target = buildReactionKey(inputs, outputs)
  if (!target) return []

  return citations.filter((c) => {
    if (!c.reactionKey) return false
    return canonicalizeReactionKey(c.reactionKey) === target
  })
}

/**
 * Find citations whose `transmutation` matches the given Z (and optional A) pair.
 * If `fromA`/`toA` are omitted, matches at the element level.
 * Citation entries with element-level-only transmutations match any A.
 */
export function getCitationsForTransmutation(
  fromZ: number,
  toZ: number,
  fromA?: number,
  toA?: number
): Citation[] {
  return citations.filter((c) => {
    const t = c.transmutation
    if (!t) return false
    if (t.fromZ !== fromZ || t.toZ !== toZ) return false
    if (fromA != null && t.fromA != null && t.fromA !== fromA) return false
    if (toA != null && t.toA != null && t.toA !== toA) return false
    return true
  })
}

/**
 * Citations that involve element Z on either side of a transmutation.
 * Useful for the element details card.
 */
export function getCitationsForElement(Z: number): Citation[] {
  return citations.filter((c) => {
    const t = c.transmutation
    if (!t) return false
    return t.fromZ === Z || t.toZ === Z
  })
}

/** Resolve a list of citation IDs to Citation entries (skips unknowns). */
export function resolveCitationIds(ids: string[]): Citation[] {
  return ids.map((id) => citationById[id]).filter((c): c is Citation => Boolean(c))
}

export { citations, citationById }
