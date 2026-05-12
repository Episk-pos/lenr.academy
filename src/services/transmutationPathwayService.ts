/**
 * Transmutation Pathway Service
 *
 * Searches the Parkhomov TwoToTwoAll table for one- or two-step pathways that
 * transform a source nuclide into a target nuclide via elementary A+B→C+D
 * reactions. The first cut intentionally limits depth to two steps; deeper
 * searches are combinatorially explosive and are handled separately by the
 * Cascade Discovery feature.
 *
 * Conservation:
 *   Z_in1 + Z_in2 = Z_out1 + Z_out2
 *   A_in1 + A_in2 = A_out1 + A_out2
 *
 * A pathway is a sequence of TwoToTwoReaction "steps" where:
 *   - Step 1's input includes the source nuclide (Z=fromZ, A=fromA)
 *   - The final step's output includes the target nuclide (Z=toZ, A=toA)
 *   - For two-step pathways, an intermediate nuclide produced in step 1 is
 *     consumed in step 2.
 */

import type { Database } from 'sql.js';
import type { TwoToTwoReaction } from '../types';

export interface PathwayStep {
  reaction: TwoToTwoReaction;
  /** Which side of the reaction (1 or 2) is the source/intermediate input */
  sourceSlot: 1 | 2;
  /** Which side of the reaction output is the product (3 or 4) */
  productSlot: 3 | 4;
}

export interface Pathway {
  /** Ordered list of reaction steps */
  steps: PathwayStep[];
  /** Sum of MeV across all steps (positive = exothermic overall) */
  totalMeV: number;
  /** For multi-step paths, the intermediate nuclides chained between steps */
  intermediates: Array<{ E: string; Z: number; A: number }>;
}

export interface FindPathwayOptions {
  /** Maximum number of pathways to return (default 50) */
  maxResults?: number;
  /** Only include pathways with totalMeV ≥ this value */
  minTotalMeV?: number;
  /** Maximum number of one-step candidate reactions to seed two-step search (default 200) */
  seedLimit?: number;
}

const DEFAULT_MAX_RESULTS = 50;
const DEFAULT_SEED_LIMIT = 200;

/**
 * Convert a sql.js exec result row (array) into a TwoToTwoReaction-shaped object.
 */
function rowToReaction(columns: string[], row: unknown[]): TwoToTwoReaction {
  const obj: Record<string, unknown> = {};
  columns.forEach((col, idx) => {
    obj[col] = row[idx];
  });
  return obj as unknown as TwoToTwoReaction;
}

/**
 * Find one-step pathways: a single TwoToTwoAll reaction whose input set includes
 * the source nuclide and whose output set includes the target nuclide.
 */
export function findOneStepPathways(
  db: Database,
  fromZ: number,
  fromA: number,
  toZ: number,
  toA: number,
  options: FindPathwayOptions = {}
): Pathway[] {
  const minMeV = options.minTotalMeV;
  const limit = Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS);

  // We need the source on either input side AND the target on either output side.
  const params: (number | string)[] = [];
  const conditions: string[] = [];

  // (Z1=from, A1=from) OR (Z2=from, A2=from)
  conditions.push('((Z1 = ? AND A1 = ?) OR (Z2 = ? AND A2 = ?))');
  params.push(fromZ, fromA, fromZ, fromA);

  // (Z3=to, A3=to) OR (Z4=to, A4=to)
  conditions.push('((Z3 = ? AND A3 = ?) OR (Z4 = ? AND A4 = ?))');
  params.push(toZ, toA, toZ, toA);

  if (minMeV !== undefined) {
    conditions.push('MeV >= ?');
    params.push(minMeV);
  }

  const sql = `
    SELECT * FROM TwoToTwoAll
    WHERE ${conditions.join(' AND ')}
    ORDER BY MeV DESC
    LIMIT ${limit}
  `;

  const results = db.exec(sql, params);
  if (results.length === 0) return [];

  const columns = results[0].columns as string[];
  const pathways: Pathway[] = [];

  for (const row of results[0].values) {
    const r = rowToReaction(columns, row);
    const sourceSlot: 1 | 2 = r.Z1 === fromZ && r.A1 === fromA ? 1 : 2;
    const productSlot: 3 | 4 = r.Z3 === toZ && r.A3 === toA ? 3 : 4;
    pathways.push({
      steps: [{ reaction: r, sourceSlot, productSlot }],
      totalMeV: r.MeV,
      intermediates: [],
    });
  }

  return pathways;
}

/**
 * Find two-step pathways: two TwoToTwoAll reactions chained via an intermediate
 * nuclide. The intermediate is one of the outputs of step 1 and one of the
 * inputs of step 2.
 *
 * Strategy:
 *   1. Pull a bounded set of "step-1" candidate reactions whose input contains
 *      the source nuclide. (Capped by seedLimit.)
 *   2. For each intermediate nuclide they produce, query "step-2" reactions
 *      whose input includes that intermediate AND whose output includes the
 *      target. Aggregate matches.
 */
export function findTwoStepPathways(
  db: Database,
  fromZ: number,
  fromA: number,
  toZ: number,
  toA: number,
  options: FindPathwayOptions = {}
): Pathway[] {
  const limit = Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS);
  const seedLimit = Math.max(1, options.seedLimit ?? DEFAULT_SEED_LIMIT);
  const minTotalMeV = options.minTotalMeV;

  // 1. Seed reactions: source nuclide on either input side.
  const seedSql = `
    SELECT * FROM TwoToTwoAll
    WHERE (Z1 = ? AND A1 = ?) OR (Z2 = ? AND A2 = ?)
    ORDER BY MeV DESC
    LIMIT ${seedLimit}
  `;
  const seedResults = db.exec(seedSql, [fromZ, fromA, fromZ, fromA]);
  if (seedResults.length === 0) return [];

  const seedColumns = seedResults[0].columns as string[];
  const seedReactions = seedResults[0].values.map((row) =>
    rowToReaction(seedColumns, row)
  );

  // 2. Build list of distinct intermediate nuclides (and which side they came out on).
  // Map: "Z-A" -> {Z, A}
  const intermediateSet = new Map<string, { Z: number; A: number }>();
  for (const r of seedReactions) {
    intermediateSet.set(`${r.Z3}-${r.A3}`, { Z: r.Z3, A: r.A3 });
    intermediateSet.set(`${r.Z4}-${r.A4}`, { Z: r.Z4, A: r.A4 });
  }

  const pathways: Pathway[] = [];

  // 3. For each intermediate, find step-2 reactions consuming it that produce the target.
  for (const inter of intermediateSet.values()) {
    // Skip if the intermediate IS the target — that's a 1-step pathway, handled separately.
    if (inter.Z === toZ && inter.A === toA) continue;

    const step2Sql = `
      SELECT * FROM TwoToTwoAll
      WHERE ((Z1 = ? AND A1 = ?) OR (Z2 = ? AND A2 = ?))
        AND ((Z3 = ? AND A3 = ?) OR (Z4 = ? AND A4 = ?))
      ORDER BY MeV DESC
    `;
    const step2Results = db.exec(step2Sql, [
      inter.Z,
      inter.A,
      inter.Z,
      inter.A,
      toZ,
      toA,
      toZ,
      toA,
    ]);
    if (step2Results.length === 0 || step2Results[0].values.length === 0) continue;

    const step2Columns = step2Results[0].columns as string[];
    const step2Reactions = step2Results[0].values.map((row) =>
      rowToReaction(step2Columns, row)
    );

    // For each step-1 reaction that produced this intermediate, pair with each step-2 reaction.
    const seedsForThisIntermediate = seedReactions.filter(
      (r) =>
        (r.Z3 === inter.Z && r.A3 === inter.A) ||
        (r.Z4 === inter.Z && r.A4 === inter.A)
    );

    for (const s1 of seedsForThisIntermediate) {
      const sourceSlot1: 1 | 2 = s1.Z1 === fromZ && s1.A1 === fromA ? 1 : 2;
      const productSlot1: 3 | 4 =
        s1.Z3 === inter.Z && s1.A3 === inter.A ? 3 : 4;

      for (const s2 of step2Reactions) {
        const sourceSlot2: 1 | 2 =
          s2.Z1 === inter.Z && s2.A1 === inter.A ? 1 : 2;
        const productSlot2: 3 | 4 = s2.Z3 === toZ && s2.A3 === toA ? 3 : 4;

        const totalMeV = s1.MeV + s2.MeV;
        if (minTotalMeV !== undefined && totalMeV < minTotalMeV) continue;

        const interElement =
          productSlot1 === 3 ? s1.E3 : s1.E4;

        pathways.push({
          steps: [
            { reaction: s1, sourceSlot: sourceSlot1, productSlot: productSlot1 },
            { reaction: s2, sourceSlot: sourceSlot2, productSlot: productSlot2 },
          ],
          totalMeV,
          intermediates: [{ E: interElement, Z: inter.Z, A: inter.A }],
        });

        if (pathways.length >= limit) break;
      }
      if (pathways.length >= limit) break;
    }
    if (pathways.length >= limit) break;
  }

  // Sort by total MeV descending, tie-break by step count (prefer shorter)
  pathways.sort((a, b) => {
    if (a.steps.length !== b.steps.length) return a.steps.length - b.steps.length;
    return b.totalMeV - a.totalMeV;
  });

  return pathways.slice(0, limit);
}

/**
 * Convenience wrapper: search for both 1-step and 2-step pathways and return
 * them merged, with 1-step results listed first.
 */
export function findPathways(
  db: Database,
  fromZ: number,
  fromA: number,
  toZ: number,
  toA: number,
  options: FindPathwayOptions = {}
): Pathway[] {
  const limit = Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS);
  const oneStep = findOneStepPathways(db, fromZ, fromA, toZ, toA, {
    ...options,
    maxResults: limit,
  });

  if (oneStep.length >= limit) {
    return oneStep.slice(0, limit);
  }

  const twoStep = findTwoStepPathways(db, fromZ, fromA, toZ, toA, {
    ...options,
    maxResults: limit - oneStep.length,
  });

  return [...oneStep, ...twoStep];
}

/**
 * Format a pathway as a human-readable string, e.g.
 *   "Cs-133 + He-4 → Ba-137 + ... | Ba-137 + He-4 → Pr-141 + ..."
 */
export function formatPathway(p: Pathway): string {
  const segments = p.steps.map((step) => {
    const r = step.reaction;
    return `${r.E1}-${r.A1} + ${r.E2}-${r.A2} → ${r.E3}-${r.A3} + ${r.E4}-${r.A4}`;
  });
  return segments.join(' | ');
}
