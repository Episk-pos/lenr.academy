/**
 * Pure-text helpers for the NuclideEquation component. Kept out of the .tsx
 * file so React Fast Refresh works correctly (it requires component-only
 * modules).
 */

/**
 * Special bare-token isotope/particle symbols. When these appear without a
 * leading mass number we render them upright (\mathrm{...}) rather than as
 * italic math identifiers.
 */
const SPECIAL_BARE_TOKENS = new Set(['d', 't', 'n', 'p', 'D', 'T', 'γ', 'gamma', 'e'])

/**
 * Convert an inline nuclide equation in the project's loose notation into a
 * KaTeX-friendly LaTeX string.
 *
 * Recognised patterns:
 *   - Mass-prefixed isotope: digits immediately followed by a 1-2 letter symbol
 *     starting with an uppercase ASCII letter, e.g. "133Cs", "4He", "96Mo".
 *   - Bare special tokens: d, t, n, p (deuteron, triton, neutron, proton),
 *     gamma photon (γ), beta/electron e — rendered upright.
 *   - Operators: × and * → \cdot, → and -> → \to.
 *   - Coefficients (plain integers) and the + sign pass through unchanged.
 *
 * Anything that doesn't match the above is left as-is, which means malformed
 * input still produces a best-effort rendering instead of a thrown error.
 */
export function toLatex(input: string): string {
  // Normalise multi-character operators first so the tokeniser doesn't have to
  // deal with multi-byte/multi-char sequences inline.
  const normalized = input
    .replace(/->/g, '→')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens: string[] = []
  let i = 0

  const isUpperAlpha = (c: string) => c >= 'A' && c <= 'Z'
  const isLowerAlpha = (c: string) => c >= 'a' && c <= 'z'
  const isDigit = (c: string) => c >= '0' && c <= '9'

  while (i < normalized.length) {
    const ch = normalized[i]

    if (ch === ' ') {
      tokens.push(' ')
      i += 1
      continue
    }

    if (ch === '×' || ch === '*') {
      tokens.push('\\cdot')
      i += 1
      continue
    }

    if (ch === '→') {
      tokens.push('\\to')
      i += 1
      continue
    }

    if (ch === '+') {
      tokens.push('+')
      i += 1
      continue
    }

    // Digit run — could be an isotope mass-prefix (followed by an uppercase
    // letter) or a standalone coefficient.
    if (isDigit(ch)) {
      let j = i
      while (j < normalized.length && isDigit(normalized[j])) j += 1
      const digits = normalized.slice(i, j)

      // Look ahead — uppercase letter starts an element symbol → isotope.
      if (j < normalized.length && isUpperAlpha(normalized[j])) {
        let k = j + 1
        // 1-2 letter element symbol: uppercase + optional lowercase.
        if (k < normalized.length && isLowerAlpha(normalized[k])) k += 1
        const symbol = normalized.slice(j, k)
        tokens.push(`{}^{${digits}}\\text{${symbol}}`)
        i = k
        continue
      }

      // Plain coefficient.
      tokens.push(digits)
      i = j
      continue
    }

    // Uppercase letter — could be a bare element symbol (no mass prefix) or a
    // special token like D / T.
    if (isUpperAlpha(ch)) {
      let k = i + 1
      if (k < normalized.length && isLowerAlpha(normalized[k])) k += 1
      const symbol = normalized.slice(i, k)
      if (SPECIAL_BARE_TOKENS.has(symbol)) {
        tokens.push(`\\mathrm{${symbol}}`)
      } else {
        // Unknown bare symbol — render as upright text so it still reads.
        tokens.push(`\\text{${symbol}}`)
      }
      i = k
      continue
    }

    // Lowercase letter — handle as bare special token (d/t/n/p/γ).
    if (isLowerAlpha(ch)) {
      // Check for multi-character word like "gamma".
      let k = i + 1
      while (k < normalized.length && isLowerAlpha(normalized[k])) k += 1
      const word = normalized.slice(i, k)
      if (SPECIAL_BARE_TOKENS.has(word)) {
        tokens.push(word === 'gamma' ? '\\gamma' : `\\mathrm{${word}}`)
      } else {
        tokens.push(`\\mathrm{${word}}`)
      }
      i = k
      continue
    }

    if (ch === 'γ') {
      tokens.push('\\gamma')
      i += 1
      continue
    }

    // Fallback — pass character through unchanged.
    tokens.push(ch)
    i += 1
  }

  // Collapse runs of whitespace tokens.
  return tokens
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
