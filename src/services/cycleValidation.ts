/**
 * Cycle Validation Service
 *
 * Provides validation functions for discovered cycles and defines
 * known reference cycles (CNO cycle, H-B11 cycle) for verification.
 */

import type { DiscoveredCycle } from '../types';

// ---------------------------------------------------------------------------
// Known reference cycles for validation
// ---------------------------------------------------------------------------

export const KNOWN_CYCLES = {
  CNO_CYCLE: {
    name: 'CNO Cycle',
    description: 'Carbon-Nitrogen-Oxygen catalytic cycle (stellar nucleosynthesis)',
    fuelNuclides: [{ E: 'H', Z: 1, A: 1 }],
    catalyst: { E: 'C', Z: 6, A: 12 },
    reactions: [
      {
        type: 'fusion' as const,
        inputs: [{ E: 'C', Z: 6, A: 12 }, { E: 'H', Z: 1, A: 1 }],
        outputs: [{ E: 'N', Z: 7, A: 13 }],
        MeV: 1.94,
        isFeedback: false,
      },
      // N-13 -> C-13 (beta+ decay, not in our reaction tables)
      {
        type: 'fusion' as const,
        inputs: [{ E: 'C', Z: 6, A: 13 }, { E: 'H', Z: 1, A: 1 }],
        outputs: [{ E: 'N', Z: 7, A: 14 }],
        MeV: 7.55,
        isFeedback: false,
      },
      {
        type: 'fusion' as const,
        inputs: [{ E: 'N', Z: 7, A: 14 }, { E: 'H', Z: 1, A: 1 }],
        outputs: [{ E: 'O', Z: 8, A: 15 }],
        MeV: 7.30,
        isFeedback: false,
      },
      // O-15 -> N-15 (beta+ decay)
      {
        type: 'twotwo' as const,
        inputs: [{ E: 'N', Z: 7, A: 15 }, { E: 'H', Z: 1, A: 1 }],
        outputs: [{ E: 'C', Z: 6, A: 12 }, { E: 'He', Z: 2, A: 4 }],
        MeV: 4.97,
        isFeedback: true,
      },
    ],
    totalEnergy: 21.76,
  },
  H1_B11: {
    name: 'Hydrogen-Boron Cycle',
    description: 'Proton-Boron-11 fusion producing helium',
    fuelNuclides: [{ E: 'H', Z: 1, A: 1 }, { E: 'B', Z: 5, A: 11 }],
    reactions: [
      {
        type: 'twotwo' as const,
        inputs: [{ E: 'H', Z: 1, A: 1 }, { E: 'B', Z: 5, A: 11 }],
        outputs: [{ E: 'He', Z: 2, A: 4 }, { E: 'Be', Z: 4, A: 8 }],
        MeV: 8.68,
        isFeedback: false,
      },
    ],
    totalEnergy: 8.68,
  },
} as const;

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Validate the structural integrity of a discovered cycle.
 *
 * Checks:
 * - reactions array is not empty
 * - cycleDepth matches reactions.length
 * - feedbackRatio is in 0-100 range
 * - abundanceScore is in 0-100 range
 * - stabilityScore is in 0-100 range
 *
 * @param cycle - The cycle to validate
 * @returns Validation result with any errors found
 */
export function validateCycleStructure(
  cycle: DiscoveredCycle
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check reactions array is not empty
  if (!cycle.reactions || cycle.reactions.length === 0) {
    errors.push('Cycle has no reactions');
  }

  // Check cycleDepth matches reactions.length
  if (cycle.cycleDepth !== cycle.reactions.length) {
    errors.push(
      `cycleDepth (${cycle.cycleDepth}) does not match reactions.length (${cycle.reactions.length})`
    );
  }

  // Check feedbackRatio in range
  if (cycle.feedbackRatio < 0 || cycle.feedbackRatio > 100) {
    errors.push(
      `feedbackRatio (${cycle.feedbackRatio}) is outside valid range 0-100`
    );
  }

  // Check abundanceScore in range
  if (cycle.abundanceScore < 0 || cycle.abundanceScore > 100) {
    errors.push(
      `abundanceScore (${cycle.abundanceScore}) is outside valid range 0-100`
    );
  }

  // Check stabilityScore in range
  if (cycle.stabilityScore < 0 || cycle.stabilityScore > 100) {
    errors.push(
      `stabilityScore (${cycle.stabilityScore}) is outside valid range 0-100`
    );
  }

  // Validate individual reactions
  if (cycle.reactions) {
    for (let i = 0; i < cycle.reactions.length; i++) {
      const reaction = cycle.reactions[i];

      if (!reaction.inputs || reaction.inputs.length === 0) {
        errors.push(`Reaction ${i} has no inputs`);
      }

      if (!reaction.outputs || reaction.outputs.length === 0) {
        errors.push(`Reaction ${i} has no outputs`);
      }

      if (!['fusion', 'twotwo', 'fission'].includes(reaction.type)) {
        errors.push(`Reaction ${i} has invalid type: ${reaction.type}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate the energy accounting of a discovered cycle.
 *
 * Sums the MeV of all reactions and compares to the reported totalEnergy.
 * Flags if the difference exceeds 0.01 MeV.
 *
 * @param cycle - The cycle to validate
 * @returns Validation result with calculated vs reported energy
 */
export function validateCycleEnergy(
  cycle: DiscoveredCycle
): { valid: boolean; calculatedEnergy: number; reportedEnergy: number; difference: number } {
  const calculatedEnergy = cycle.reactions.reduce((sum, r) => sum + r.MeV, 0);
  const reportedEnergy = cycle.totalEnergy;
  const difference = Math.abs(calculatedEnergy - reportedEnergy);

  return {
    valid: difference <= 0.01,
    calculatedEnergy,
    reportedEnergy,
    difference,
  };
}
