import { describe, it, expect } from 'vitest'
import {
  buildReactionKey,
  canonicalizeReactionKey,
  getCitationsForElement,
  getCitationsForReaction,
  getCitationsForTransmutation,
  normalizeNuclideToken,
  resolveCitationIds,
} from './citationsService'

describe('citationsService', () => {
  describe('normalizeNuclideToken', () => {
    it('canonicalizes mixed-case dashed forms', () => {
      expect(normalizeNuclideToken('d-2')).toBe('D-2')
      expect(normalizeNuclideToken('D-2')).toBe('D-2')
      expect(normalizeNuclideToken('he-4')).toBe('He-4')
      expect(normalizeNuclideToken('HE-4')).toBe('He-4')
    })

    it('resolves leading-mass hydrogen aliases (1H, 2H, 3H)', () => {
      expect(normalizeNuclideToken('1H')).toBe('H-1')
      expect(normalizeNuclideToken('2H')).toBe('D-2')
      expect(normalizeNuclideToken('3H')).toBe('T-3')
    })

    it('handles bare element symbols', () => {
      expect(normalizeNuclideToken('Fe')).toBe('Fe')
      expect(normalizeNuclideToken('cs')).toBe('Cs')
    })
  })

  describe('canonicalizeReactionKey', () => {
    it('alphabetizes the left and right sides', () => {
      expect(canonicalizeReactionKey('Li-7+H-1->He-4+He-4')).toBe(
        'H-1+Li-7->He-4+He-4'
      )
    })

    it('round-trips a canonical key', () => {
      expect(canonicalizeReactionKey('D-2+D-2->He-4')).toBe('D-2+D-2->He-4')
    })

    it('returns empty for malformed input', () => {
      expect(canonicalizeReactionKey('not a reaction')).toBe('')
      expect(canonicalizeReactionKey('')).toBe('')
    })
  })

  describe('buildReactionKey', () => {
    it('builds a key from object form', () => {
      expect(
        buildReactionKey(
          [
            { symbol: 'D', A: 2 },
            { symbol: 'D', A: 2 },
          ],
          [{ symbol: 'He', A: 4 }]
        )
      ).toBe('D-2+D-2->He-4')
    })

    it('builds a key from string tokens (case-insensitive)', () => {
      expect(buildReactionKey(['d-2', 'd-2'], ['he-4'])).toBe('D-2+D-2->He-4')
    })

    it('alphabetizes inputs and outputs', () => {
      expect(
        buildReactionKey(
          [
            { symbol: 'Li', A: 7 },
            { symbol: 'H', A: 1 },
          ],
          [
            { symbol: 'He', A: 4 },
            { symbol: 'He', A: 4 },
          ]
        )
      ).toBe('H-1+Li-7->He-4+He-4')
    })
  })

  describe('getCitationsForReaction', () => {
    it('finds the d+d->He-4 citations', () => {
      const results = getCitationsForReaction(
        { symbol: 'D', A: 2 },
        { symbol: 'D', A: 2 },
        { symbol: 'He', A: 4 }
      )
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((c) => c.id === 'miles-1990-he4')).toBe(true)
      expect(results.some((c) => c.id === 'hubler-violante-2014')).toBe(true)
    })

    it('matches regardless of input order', () => {
      const a = getCitationsForReaction('D-2', 'D-2', 'He-4')
      const b = getCitationsForReaction('d-2', 'D-2', 'he-4')
      expect(a.map((c) => c.id).sort()).toEqual(b.map((c) => c.id).sort())
    })

    it('returns empty array when nothing matches', () => {
      expect(
        getCitationsForReaction(
          { symbol: 'C', A: 12 },
          { symbol: 'O', A: 16 },
          { symbol: 'Si', A: 28 }
        )
      ).toEqual([])
    })

    it('handles two-to-two when an output is provided', () => {
      // Not currently in dataset but should not throw.
      expect(() =>
        getCitationsForReaction('H-1', 'Li-7', 'He-4', 'He-4')
      ).not.toThrow()
    })
  })

  describe('getCitationsForTransmutation', () => {
    it('finds Cs (Z=55) -> Pr (Z=59) citations', () => {
      const results = getCitationsForTransmutation(55, 59)
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((c) => c.id === 'iwamura-2002-cs-pr')).toBe(true)
    })

    it('matches A only when both citation A and query A are specified', () => {
      const exact = getCitationsForTransmutation(55, 59, 133, 141)
      expect(exact.some((c) => c.id === 'iwamura-2002-cs-pr')).toBe(true)
    })

    it('rejects mismatched A when both are specified', () => {
      const wrongA = getCitationsForTransmutation(55, 59, 137, 141)
      expect(wrongA.some((c) => c.id === 'iwamura-2002-cs-pr')).toBe(false)
    })

    it('matches element-level citations when query A is provided', () => {
      // savvatimova-pd-products has Z=46 -> Z=47 with no fromA/toA;
      // querying with explicit A should still match.
      const results = getCitationsForTransmutation(46, 47, 105, 107)
      expect(results.some((c) => c.id === 'savvatimova-pd-products')).toBe(true)
    })

    it('returns empty for unknown Z pairs', () => {
      expect(getCitationsForTransmutation(1, 2)).toEqual([])
    })
  })

  describe('getCitationsForElement', () => {
    it('matches as the source of a transmutation', () => {
      const results = getCitationsForElement(55) // Cs
      expect(results.some((c) => c.id === 'iwamura-2002-cs-pr')).toBe(true)
    })

    it('matches as the product of a transmutation', () => {
      const results = getCitationsForElement(59) // Pr
      expect(results.some((c) => c.id === 'iwamura-2002-cs-pr')).toBe(true)
    })

    it('returns empty when element has no documented transmutations', () => {
      // Hydrogen (Z=1) is not the from/to side of any transmutation citation.
      expect(getCitationsForElement(1)).toEqual([])
    })
  })

  describe('resolveCitationIds', () => {
    it('returns the citations in order', () => {
      const ids = ['miles-1990-he4', 'iwamura-2002-cs-pr']
      const results = resolveCitationIds(ids)
      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('miles-1990-he4')
      expect(results[1].id).toBe('iwamura-2002-cs-pr')
    })

    it('skips unknown ids silently', () => {
      const results = resolveCitationIds(['miles-1990-he4', 'does-not-exist'])
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('miles-1990-he4')
    })
  })
})
