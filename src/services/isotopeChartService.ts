import type { Database } from 'sql.js';
import type {
  Nuclide,
  ChartNuclide,
  NuclideStability,
  ReactionPathway,
  Reaction,
  FusionReaction,
  FissionReaction,
  TwoToTwoReaction,
  ReactionType,
} from '../types';

/**
 * Magic numbers in nuclear physics
 * Nuclides with magic numbers of protons or neutrons are particularly stable
 */
export const MAGIC_NUMBERS = [2, 8, 20, 28, 50, 82, 126];

/**
 * Determine nuclide stability based on log half-life
 * @param nuclide - Nuclide data from NuclidesPlus
 * @returns Stability classification
 */
export function getNuclideStability(nuclide: Pick<Nuclide, 'logHalfLife'>): NuclideStability {
  if (!nuclide.logHalfLife && nuclide.logHalfLife !== 0) return 'unknown';

  const lhl = nuclide.logHalfLife;

  if (lhl > 9) return 'stable';      // > 1 billion years
  if (lhl > 2) return 'long';        // > 100 years
  return 'short';                     // ≤ 100 years
}

/**
 * Get all nuclides from database formatted for chart display
 * Calculates neutron count (N = A - Z) and stability for each nuclide
 */
export function getAllNuclidesForChart(db: Database): ChartNuclide[] {
  const sql = `
    SELECT Z, A, E, LHL
    FROM NuclidesPlus
    WHERE Z >= 1
    ORDER BY Z, A
  `;

  const results = db.exec(sql);
  const nuclides: ChartNuclide[] = [];

  if (results.length > 0) {
    const values = results[0].values;

    values.forEach((row: any[]) => {
      const Z = row[0] as number;
      const A = row[1] as number;
      const E = row[2] as string;
      const LHL = row[3] as number | null;

      const N = A - Z;
      const logHalfLife = LHL ?? undefined;
      const stability = getNuclideStability({ logHalfLife });

      nuclides.push({
        Z,
        N,
        A,
        E,
        logHalfLife,
        stability,
      });
    });
  }

  return nuclides;
}

/**
 * Calculate points for the valley of stability line
 * The valley represents the most stable neutron-to-proton ratio
 *
 * Formula:
 * - Light elements (Z < 20): N ≈ Z
 * - Medium elements (20 ≤ Z < 84): N ≈ 1.5 × Z
 * - Heavy elements (Z ≥ 84): follows empirical curve
 *
 * @param maxZ - Maximum atomic number to calculate (default 94)
 * @returns Array of [Z, N] points defining the valley line
 */
export function getValleyOfStabilityPoints(maxZ: number = 94): Array<[number, number]> {
  const points: Array<[number, number]> = [];

  for (let Z = 1; Z <= maxZ; Z++) {
    let N: number;

    if (Z < 20) {
      // Light elements: N ≈ Z
      N = Z;
    } else if (Z < 84) {
      // Medium elements: N ≈ 1.5 × Z
      N = Math.round(1.5 * Z);
    } else {
      // Heavy elements: empirical formula
      // N ≈ 1.5 × Z + (Z - 84) × 0.4
      N = Math.round(1.5 * Z + (Z - 84) * 0.4);
    }

    points.push([Z, N]);
  }

  return points;
}

/**
 * Check if a proton or neutron count is a magic number
 */
export function isMagicNumber(count: number): boolean {
  return MAGIC_NUMBERS.includes(count);
}

/**
 * Convert query results to reaction pathways for visualization
 *
 * @param reactions - Array of reactions from query results
 * @param reactionType - Type of reaction ('fusion' | 'fission' | 'twotwo')
 * @param limit - Maximum number of pathways to include (default 50 for performance)
 * @returns Array of ReactionPathway objects with from/to coordinates
 */
export function calculateReactionPathways(
  reactions: Reaction[],
  reactionType: ReactionType,
  limit: number = 50
): ReactionPathway[] {
  const pathways: ReactionPathway[] = [];

  // Limit to first N reactions for performance
  const limitedReactions = reactions.slice(0, limit);

  limitedReactions.forEach((r) => {
    if (reactionType === 'fusion') {
      const reaction = r as FusionReaction;
      pathways.push({
        from: [
          { Z: reaction.Z1, N: reaction.A1 - reaction.Z1, E: reaction.E1, A: reaction.A1 },
          { Z: reaction.Z2, N: reaction.A2 - reaction.Z2, E: reaction.E2, A: reaction.A2 },
        ],
        to: [
          { Z: reaction.Z, N: reaction.A - reaction.Z, E: reaction.E, A: reaction.A },
        ],
        reactionType: 'fusion',
        MeV: reaction.MeV,
      });
    } else if (reactionType === 'fission') {
      const reaction = r as FissionReaction;
      pathways.push({
        from: [
          { Z: reaction.Z, N: reaction.A - reaction.Z, E: reaction.E, A: reaction.A },
        ],
        to: [
          { Z: reaction.Z1, N: reaction.A1 - reaction.Z1, E: reaction.E1, A: reaction.A1 },
          { Z: reaction.Z2, N: reaction.A2 - reaction.Z2, E: reaction.E2, A: reaction.A2 },
        ],
        reactionType: 'fission',
        MeV: reaction.MeV,
      });
    } else {
      // twotwo
      const reaction = r as TwoToTwoReaction;
      pathways.push({
        from: [
          { Z: reaction.Z1, N: reaction.A1 - reaction.Z1, E: reaction.E1, A: reaction.A1 },
          { Z: reaction.Z2, N: reaction.A2 - reaction.Z2, E: reaction.E2, A: reaction.A2 },
        ],
        to: [
          { Z: reaction.Z3, N: reaction.A3 - reaction.Z3, E: reaction.E3, A: reaction.A3 },
          { Z: reaction.Z4, N: reaction.A4 - reaction.Z4, E: reaction.E4, A: reaction.A4 },
        ],
        reactionType: 'twotwo',
        MeV: reaction.MeV,
      });
    }
  });

  return pathways;
}

/**
 * Get color for nuclide stability
 * Returns Tailwind CSS color classes
 */
export function getStabilityColor(stability: NuclideStability, isDark: boolean): string {
  switch (stability) {
    case 'stable':
      return isDark ? '#22c55e' : '#16a34a';  // green-500 / green-600
    case 'long':
      return isDark ? '#f97316' : '#ea580c';  // orange-500 / orange-600
    case 'short':
      return isDark ? '#ef4444' : '#dc2626';  // red-500 / red-600
    case 'unknown':
      return isDark ? '#4b5563' : '#d1d5db';  // gray-600 / gray-300
  }
}

/**
 * Get color for reaction pathway arrows based on reaction type
 */
export function getReactionPathColor(reactionType: ReactionType): string {
  switch (reactionType) {
    case 'fusion':
      return '#3b82f6';  // blue-500
    case 'fission':
      return '#ef4444';  // red-500
    case 'twotwo':
      return '#a855f7';  // purple-500
  }
}
