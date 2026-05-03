import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from 'sql.js';
import {
  findOneStepPathways,
  findTwoStepPathways,
  findPathways,
  formatPathway,
  type Pathway,
} from './transmutationPathwayService';

// ---------- Helpers ----------

const TWO_TO_TWO_COLUMNS = [
  'id',
  'E1', 'Z1', 'A1',
  'E2', 'Z2', 'A2',
  'E3', 'Z3', 'A3',
  'E4', 'Z4', 'A4',
  'MeV',
  'neutrino',
  'nBorF1', 'aBorF1',
  'nBorF2', 'aBorF2',
  'nBorF3', 'aBorF3',
  'nBorF4', 'aBorF4',
];

interface ReactionRow {
  id: number;
  E1: string; Z1: number; A1: number;
  E2: string; Z2: number; A2: number;
  E3: string; Z3: number; A3: number;
  E4: string; Z4: number; A4: number;
  MeV: number;
}

function reactionRow(r: ReactionRow): unknown[] {
  return [
    r.id,
    r.E1, r.Z1, r.A1,
    r.E2, r.Z2, r.A2,
    r.E3, r.Z3, r.A3,
    r.E4, r.Z4, r.A4,
    r.MeV,
    'none',
    'b', 'b',
    'b', 'b',
    'b', 'b',
    'b', 'b',
  ];
}

/**
 * Build a fake `db.exec` that, given a TwoToTwoAll fixture, evaluates the
 * predicates the service uses (input contains source, output contains target,
 * etc). This mirrors what sqlite would do but in-memory and with no WASM cost.
 *
 * The implementation is deliberately narrow — it only supports the patterns
 * used by transmutationPathwayService.
 */
function makeDb(reactions: ReactionRow[]): Database {
  const exec = vi.fn((sql: string, rawParams: unknown = []) => {
      const params = (rawParams as number[]) ?? [];
      const includesAll = (terms: string[]) => terms.every(t => sql.includes(t));

      // Step-1 seed query OR one-step seed:
      //   "WHERE (Z1 = ? AND A1 = ?) OR (Z2 = ? AND A2 = ?)"
      const isSeedOnly = includesAll(['FROM TwoToTwoAll', '(Z1 = ? AND A1 = ?) OR (Z2 = ? AND A2 = ?)'])
        && !sql.includes('AND ((Z3');

      // One-step pathway query:
      //   includes BOTH "input contains" AND "output contains"
      const isOneStep = includesAll([
        '(Z1 = ? AND A1 = ?) OR (Z2 = ? AND A2 = ?)',
        '(Z3 = ? AND A3 = ?) OR (Z4 = ? AND A4 = ?)',
      ]);

      let filtered: ReactionRow[] = [];

      if (isSeedOnly) {
        const [fromZ, fromA] = params;
        filtered = reactions.filter(r =>
          (r.Z1 === fromZ && r.A1 === fromA) ||
          (r.Z2 === fromZ && r.A2 === fromA)
        );

        // Optional MeV filter
        const mevMatch = sql.match(/MeV >= \?/);
        if (mevMatch) {
          const minMeV = params[4];
          filtered = filtered.filter(r => r.MeV >= minMeV);
        }
      } else if (isOneStep) {
        const [fromZ, fromA, , , toZ, toA] = params;
        filtered = reactions.filter(r => {
          const inputMatch =
            (r.Z1 === fromZ && r.A1 === fromA) ||
            (r.Z2 === fromZ && r.A2 === fromA);
          const outputMatch =
            (r.Z3 === toZ && r.A3 === toA) ||
            (r.Z4 === toZ && r.A4 === toA);
          return inputMatch && outputMatch;
        });
      }

      filtered.sort((a, b) => b.MeV - a.MeV);

      // Apply LIMIT
      const limitMatch = sql.match(/LIMIT (\d+)/);
      if (limitMatch) {
        filtered = filtered.slice(0, parseInt(limitMatch[1], 10));
      }

      if (filtered.length === 0) return [];

      return [
        {
          columns: TWO_TO_TWO_COLUMNS,
          values: filtered.map(reactionRow),
        },
      ];
    });

  return { exec } as unknown as Database;
}

// ---------- Fixtures ----------

// Cs-133 + He-4 → Ba-137 + n? — synthetic fixture.
// We'll use a simple chain:
//    Step 1: Cs-133 (Z=55,A=133) + He-4 (Z=2,A=4) → Ba-137 (Z=56,A=137) + H-? (Z=1,A=0)
//    Step 2: Ba-137 (Z=56,A=137) + He-4 (Z=2,A=4) → Pr-141 (Z=59,A=141) + n (Z=0,A=0)
// Note: We don't worry about strict conservation in fixtures — only that
// the slot-matching logic in the service works as designed.
const CS_133_TO_PR_141: ReactionRow[] = [
  {
    id: 1,
    E1: 'Cs', Z1: 55, A1: 133,
    E2: 'He', Z2: 2,  A2: 4,
    E3: 'Ba', Z3: 56, A3: 137,
    E4: 'H',  Z4: 1,  A4: 0,
    MeV: 4.2,
  },
  {
    id: 2,
    E1: 'Ba', Z1: 56, A1: 137,
    E2: 'He', Z2: 2,  A2: 4,
    E3: 'Pr', Z3: 59, A3: 141,
    E4: 'n',  Z4: 0,  A4: 0,
    MeV: 3.8,
  },
];

// One-step direct: He-4 + He-4 → Be-8 + something
const DIRECT_ONE_STEP: ReactionRow[] = [
  {
    id: 10,
    E1: 'H', Z1: 1, A1: 1,
    E2: 'Li', Z2: 3, A2: 7,
    E3: 'He', Z3: 2, A3: 4,
    E4: 'He', Z4: 2, A4: 4,
    MeV: 17.3,
  },
];

// ---------- Tests ----------

describe('transmutationPathwayService', () => {
  describe('findOneStepPathways', () => {
    let db: Database;

    beforeEach(() => {
      db = makeDb(DIRECT_ONE_STEP);
    });

    it('finds a direct one-step pathway with input on slot 1 and output on slot 3', () => {
      // H-1 → He-4 (one-step via H+Li→He+He)
      const result = findOneStepPathways(db, 1, 1, 2, 4);
      expect(result).toHaveLength(1);
      expect(result[0].steps).toHaveLength(1);
      expect(result[0].totalMeV).toBe(17.3);
      expect(result[0].steps[0].sourceSlot).toBe(1);
      expect(result[0].steps[0].productSlot).toBe(3);
      expect(result[0].intermediates).toEqual([]);
    });

    it('returns empty array when no reactions match', () => {
      const emptyDb = makeDb([]);
      const result = findOneStepPathways(emptyDb, 1, 1, 92, 238);
      expect(result).toEqual([]);
    });

    it('respects maxResults cap', () => {
      // Three identical-shape reactions
      const many: ReactionRow[] = Array.from({ length: 5 }, (_, i) => ({
        ...DIRECT_ONE_STEP[0],
        id: 100 + i,
        MeV: 10 + i,
      }));
      const manyDb = makeDb(many);
      const result = findOneStepPathways(manyDb, 1, 1, 2, 4, { maxResults: 2 });
      expect(result).toHaveLength(2);
      // Sorted by MeV DESC, so we get the highest two
      expect(result[0].totalMeV).toBe(14);
      expect(result[1].totalMeV).toBe(13);
    });

    it('detects source on slot 2 and product on slot 4', () => {
      const swapped: ReactionRow[] = [
        {
          id: 20,
          E1: 'X', Z1: 99, A1: 99,
          E2: 'Cs', Z2: 55, A2: 133,
          E3: 'Y',  Z3: 99, A3: 99,
          E4: 'Pr', Z4: 59, A4: 141,
          MeV: 5.0,
        },
      ];
      const swappedDb = makeDb(swapped);
      const result = findOneStepPathways(swappedDb, 55, 133, 59, 141);
      expect(result).toHaveLength(1);
      expect(result[0].steps[0].sourceSlot).toBe(2);
      expect(result[0].steps[0].productSlot).toBe(4);
    });
  });

  describe('findTwoStepPathways', () => {
    it('chains Cs-133 → Ba-137 → Pr-141 via He-4 alpha capture', () => {
      const db = makeDb(CS_133_TO_PR_141);
      const pathways = findTwoStepPathways(db, 55, 133, 59, 141);

      expect(pathways.length).toBeGreaterThanOrEqual(1);
      const p = pathways[0];
      expect(p.steps).toHaveLength(2);
      expect(p.intermediates).toEqual([{ E: 'Ba', Z: 56, A: 137 }]);
      expect(p.totalMeV).toBeCloseTo(4.2 + 3.8);

      // Step 1: Cs source (slot 1) → Ba intermediate (slot 3)
      expect(p.steps[0].sourceSlot).toBe(1);
      expect(p.steps[0].productSlot).toBe(3);

      // Step 2: Ba intermediate (slot 1) → Pr product (slot 3)
      expect(p.steps[1].sourceSlot).toBe(1);
      expect(p.steps[1].productSlot).toBe(3);
    });

    it('returns empty when no chained pathway exists', () => {
      // Only step-2 reaction is present — no seed reaction starts from Cs-133
      const db = makeDb([CS_133_TO_PR_141[1]]);
      const pathways = findTwoStepPathways(db, 55, 133, 59, 141);
      expect(pathways).toEqual([]);
    });

    it('respects minTotalMeV filter', () => {
      const db = makeDb(CS_133_TO_PR_141);
      const pathways = findTwoStepPathways(db, 55, 133, 59, 141, {
        minTotalMeV: 100,
      });
      expect(pathways).toEqual([]);
    });

    it('skips intermediate equal to target (defers to one-step search)', () => {
      // Only reaction available is "source on input, target on output" — i.e. a
      // direct one-step pathway. findTwoStepPathways must not surface it.
      // We pick a step-1 candidate whose only intermediate IS the target.
      const seedDirectlyHitsTarget: ReactionRow[] = [
        {
          id: 30,
          E1: 'He', Z1: 2, A1: 4,
          E2: 'X',  Z2: 7, A2: 14,
          E3: 'Pr', Z3: 59, A3: 141,
          E4: 'Y',  Z4: 8, A4: 16,
          MeV: 5.0,
        },
      ];
      const db = makeDb(seedDirectlyHitsTarget);
      // The intermediates set is {Pr-141 (target, skipped), Y-16 (no step-2)}.
      // Therefore findTwoStepPathways should produce no chained pathways.
      const pathways = findTwoStepPathways(db, 2, 4, 59, 141);
      expect(pathways).toEqual([]);
    });

    it('caps to maxResults', () => {
      // Build many seed reactions all producing Ba-137, plus one step-2 for each.
      const reactions: ReactionRow[] = [];
      for (let i = 0; i < 5; i++) {
        reactions.push({
          id: 1000 + i,
          E1: 'Cs', Z1: 55, A1: 133,
          E2: 'He', Z2: 2, A2: 4,
          E3: 'Ba', Z3: 56, A3: 137,
          E4: 'X',  Z4: 0, A4: 0,
          MeV: 1 + i,
        });
      }
      reactions.push(CS_133_TO_PR_141[1]); // The step-2 reaction
      const db = makeDb(reactions);
      const pathways = findTwoStepPathways(db, 55, 133, 59, 141, { maxResults: 3 });
      expect(pathways.length).toBeLessThanOrEqual(3);
    });
  });

  describe('findPathways (combined)', () => {
    it('returns one-step results first', () => {
      // Same fixture: H-1 → He-4 has a direct one-step.
      const db = makeDb(DIRECT_ONE_STEP);
      const pathways = findPathways(db, 1, 1, 2, 4);
      expect(pathways.length).toBeGreaterThan(0);
      expect(pathways[0].steps).toHaveLength(1);
    });

    it('falls through to two-step search when no one-step exists', () => {
      const db = makeDb(CS_133_TO_PR_141);
      const pathways = findPathways(db, 55, 133, 59, 141);
      expect(pathways.length).toBeGreaterThan(0);
      // No 1-step Cs-133 → Pr-141 exists in the fixture, so the first result is 2-step.
      expect(pathways[0].steps).toHaveLength(2);
    });
  });

  describe('formatPathway', () => {
    it('formats a single-step pathway', () => {
      const p: Pathway = {
        steps: [
          {
            reaction: {
              id: 1,
              E1: 'H', Z1: 1, A1: 1,
              E2: 'Li', Z2: 3, A2: 7,
              E3: 'He', Z3: 2, A3: 4,
              E4: 'He', Z4: 2, A4: 4,
              MeV: 17.3,
              neutrino: 'none',
              nBorF1: 'b', aBorF1: 'b',
              nBorF2: 'b', aBorF2: 'b',
              nBorF3: 'b', aBorF3: 'b',
              nBorF4: 'b', aBorF4: 'b',
            },
            sourceSlot: 1,
            productSlot: 3,
          },
        ],
        totalMeV: 17.3,
        intermediates: [],
      };
      expect(formatPathway(p)).toBe('H-1 + Li-7 → He-4 + He-4');
    });

    it('formats a multi-step pathway with " | " separator', () => {
      const db = makeDb(CS_133_TO_PR_141);
      const pathways = findTwoStepPathways(db, 55, 133, 59, 141);
      const out = formatPathway(pathways[0]);
      expect(out).toContain('Cs-133');
      expect(out).toContain('Pr-141');
      expect(out).toContain(' | ');
    });
  });
});
