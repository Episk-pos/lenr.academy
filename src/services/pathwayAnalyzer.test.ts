import { describe, it, expect } from 'vitest';
import {
  analyzePathways,
  filterPathways,
  getPathwayStats,
  type PathwayAnalysis,
} from './pathwayAnalyzer';

// Helper to create test reactions
function createReaction(
  type: 'fusion' | 'twotwo',
  inputs: string[],
  outputs: string[],
  MeV: number,
  loop: number
) {
  return { type, inputs, outputs, MeV, loop };
}

describe('pathwayAnalyzer', () => {
  describe('analyzePathways', () => {
    it('should return empty array for no reactions', () => {
      const result = analyzePathways([]);

      expect(result).toEqual([]);
    });

    it('should create a single pathway for a single reaction', () => {
      const reactions = [
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 0),
      ];

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        pathway: 'H-1 + Li-7 → He-4 + He-4',
        type: 'fusion',
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4', 'He-4'],
        frequency: 1,
        avgEnergy: 17.3,
        totalEnergy: 17.3,
        loops: [0],
        isFeedback: false,
        rarityScore: 100,
      });
    });

    it('should de-duplicate identical reactions across loops', () => {
      const reactions = [
        createReaction('fusion', ['D-2', 'D-2'], ['He-3', 'n'], 3.27, 0),
        createReaction('fusion', ['D-2', 'D-2'], ['He-3', 'n'], 3.27, 1),
        createReaction('fusion', ['D-2', 'D-2'], ['He-3', 'n'], 3.27, 2),
      ];

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        frequency: 3,
        avgEnergy: 3.27,
        totalEnergy: 9.81,  // 3 × 3.27
        loops: [0, 1, 2],
      });
    });

    it('should calculate correct average energy for repeated reactions', () => {
      const reactions = [
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.0, 0),
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 1),
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.5, 2),
      ];

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(1);
      expect(result[0].avgEnergy).toBeCloseTo(17.267, 2);  // (17.0 + 17.3 + 17.5) / 3
      expect(result[0].totalEnergy).toBeCloseTo(51.8, 1);
    });

    it('should create separate pathways for different reactions', () => {
      const reactions = [
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 0),
        createReaction('fusion', ['D-2', 'D-2'], ['He-3', 'n'], 3.27, 0),
        createReaction('twotwo', ['D-2', 'Li-6'], ['He-4', 'He-4'], 22.4, 0),
      ];

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(3);
      expect(result.map((p) => p.pathway)).toEqual(
        expect.arrayContaining([
          'H-1 + Li-7 → He-4 + He-4',
          'D-2 + D-2 → He-3 + n',
          'D-2 + Li-6 → He-4 + He-4',
        ])
      );
    });

    it('should calculate rarity scores relative to max frequency', () => {
      const reactions = [
        // Pathway 1: appears 5 times
        ...Array(5).fill(null).map((_, i) =>
          createReaction('fusion', ['H-1', 'H-1'], ['D-2'], 1.0, i)
        ),
        // Pathway 2: appears 3 times
        ...Array(3).fill(null).map((_, i) =>
          createReaction('fusion', ['D-2', 'D-2'], ['He-4'], 2.0, i)
        ),
        // Pathway 3: appears 1 time
        createReaction('fusion', ['H-1', 'D-2'], ['He-3'], 3.0, 0),
      ];

      const result = analyzePathways(reactions);

      const pathway1 = result.find((p) => p.inputs.includes('H-1') && p.inputs.includes('H-1'));
      const pathway2 = result.find((p) => p.inputs.includes('D-2') && p.inputs.includes('D-2'));
      const pathway3 = result.find((p) => p.outputs.includes('He-3'));

      expect(pathway1?.rarityScore).toBe(100);     // 5/5 * 100 = 100%
      expect(pathway2?.rarityScore).toBe(60);      // 3/5 * 100 = 60%
      expect(pathway3?.rarityScore).toBe(20);      // 1/5 * 100 = 20%
    });

    it('should sort pathways by frequency (descending)', () => {
      const reactions = [
        createReaction('fusion', ['A'], ['B'], 1.0, 0),
        createReaction('fusion', ['A'], ['B'], 1.0, 1),
        createReaction('fusion', ['C'], ['D'], 2.0, 0),
        createReaction('fusion', ['C'], ['D'], 2.0, 1),
        createReaction('fusion', ['C'], ['D'], 2.0, 2),
        createReaction('fusion', ['E'], ['F'], 3.0, 0),
      ];

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(3);
      expect(result[0].frequency).toBe(3);  // C→D
      expect(result[1].frequency).toBe(2);  // A→B
      expect(result[2].frequency).toBe(1);  // E→F
    });

    it('should preserve reaction type (fusion vs twotwo)', () => {
      const reactions = [
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 0),
        createReaction('twotwo', ['D-2', 'Li-6'], ['He-4', 'He-4'], 22.4, 0),
      ];

      const result = analyzePathways(reactions);

      expect(result.find((p) => p.inputs.includes('Li-7'))?.type).toBe('fusion');
      expect(result.find((p) => p.inputs.includes('Li-6'))?.type).toBe('twotwo');
    });
  });

  describe('feedback loop detection', () => {
    it('should detect simple feedback loop (output becomes input)', () => {
      const reactions = [
        // Loop 0: H-1 + Li-7 → He-4 + He-4
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 0),
        // Loop 1: H-1 + He-4 → ... (He-4 from loop 0 used as input)
        createReaction('fusion', ['H-1', 'He-4'], ['Li-5'], 2.0, 1),
      ];

      const result = analyzePathways(reactions);

      const firstReaction = result.find((p) => p.inputs.includes('Li-7'));
      expect(firstReaction?.isFeedback).toBe(true);  // He-4 is used later as input
    });

    it('should NOT detect feedback if output never becomes input', () => {
      const reactions = [
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 0),
        createReaction('fusion', ['D-2', 'D-2'], ['He-3', 'n'], 3.27, 1),
      ];

      const result = analyzePathways(reactions);

      expect(result.every((p) => !p.isFeedback)).toBe(true);
    });

    it('should detect feedback across multiple loops', () => {
      const reactions = [
        // Loop 0: A → B
        createReaction('fusion', ['A'], ['B'], 1.0, 0),
        // Loop 1: B → C (B from loop 0 is used)
        createReaction('fusion', ['B'], ['C'], 2.0, 1),
        // Loop 2: C → D (C from loop 1 is used)
        createReaction('fusion', ['C'], ['D'], 3.0, 2),
        // Loop 3: D → A (D from loop 2 is used)
        createReaction('fusion', ['D'], ['A'], 4.0, 3),
      ];

      const result = analyzePathways(reactions);

      // Pathways that produce outputs used in later loops have feedback
      const pathwayAtoB = result.find((p) => p.inputs.includes('A') && p.outputs.includes('B'));
      const pathwayBtoC = result.find((p) => p.inputs.includes('B') && p.outputs.includes('C'));
      const pathwayCtoD = result.find((p) => p.inputs.includes('C') && p.outputs.includes('D'));

      // A→B produces B, which is used in loop 1 (feedback)
      expect(pathwayAtoB?.isFeedback).toBe(true);
      // B→C produces C, which is used in loop 2 (feedback)
      expect(pathwayBtoC?.isFeedback).toBe(true);
      // C→D produces D, which is used in loop 3 (feedback)
      expect(pathwayCtoD?.isFeedback).toBe(true);
    });

    it('should NOT detect feedback if input appears before output', () => {
      const reactions = [
        // Loop 0: Uses He-4 as input (not feedback, it's fuel)
        createReaction('fusion', ['H-1', 'He-4'], ['Li-5'], 2.0, 0),
        // Loop 1: Produces He-4 as output (after it was already used)
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 1),
      ];

      const result = analyzePathways(reactions);

      const secondReaction = result.find((p) => p.inputs.includes('Li-7'));
      expect(secondReaction?.isFeedback).toBe(false);  // He-4 was used before it was produced
    });

    it('should detect multi-hop feedback chain', () => {
      const reactions = [
        // Loop 0: A + B → C + D
        createReaction('twotwo', ['A', 'B'], ['C', 'D'], 1.0, 0),
        // Loop 1: C → E (C from loop 0)
        createReaction('fusion', ['C'], ['E'], 2.0, 1),
        // Loop 2: E + D → F (both E and D from previous loops)
        createReaction('twotwo', ['E', 'D'], ['F'], 3.0, 2),
      ];

      const result = analyzePathways(reactions);

      const firstReaction = result.find((p) => p.inputs.includes('B'));
      expect(firstReaction?.isFeedback).toBe(true);  // C and D are used in later loops
    });

    it('should handle same nuclide appearing in multiple pathways', () => {
      const reactions = [
        // Pathway 1: Produces He-4 in loop 0
        createReaction('fusion', ['H-1', 'Li-7'], ['He-4', 'He-4'], 17.3, 0),
        // Pathway 2: Also produces He-4 in loop 0
        createReaction('fusion', ['D-2', 'Li-6'], ['He-4', 'He-4'], 22.4, 0),
        // Loop 1: Uses He-4 as input
        createReaction('fusion', ['He-4', 'He-4'], ['Be-8'], 0.1, 1),
      ];

      const result = analyzePathways(reactions);

      // Both pathways that produce He-4 should be marked as feedback
      const pathway1 = result.find((p) => p.inputs.includes('Li-7'));
      const pathway2 = result.find((p) => p.inputs.includes('Li-6'));

      expect(pathway1?.isFeedback).toBe(true);
      expect(pathway2?.isFeedback).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle pathways with zero energy', () => {
      const reactions = [
        createReaction('fusion', ['A'], ['B'], 0, 0),
        createReaction('fusion', ['A'], ['B'], 0, 1),
      ];

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(1);
      expect(result[0].avgEnergy).toBe(0);
      expect(result[0].totalEnergy).toBe(0);
    });

    it('should handle pathways appearing in non-sequential loops', () => {
      const reactions = [
        createReaction('fusion', ['A'], ['B'], 1.0, 0),
        createReaction('fusion', ['A'], ['B'], 1.0, 3),
        createReaction('fusion', ['A'], ['B'], 1.0, 7),
      ];

      const result = analyzePathways(reactions);

      expect(result[0].loops).toEqual([0, 3, 7]);
      expect(result[0].frequency).toBe(3);
    });

    it('should handle pathways with single nuclide input/output', () => {
      const reactions = [
        createReaction('fusion', ['A'], ['B'], 1.0, 0),
        createReaction('fusion', ['B', 'C'], ['D'], 2.0, 1),
      ];

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(2);
      expect(result.some((p) => p.inputs.length === 1)).toBe(true);
      expect(result.some((p) => p.outputs.length === 1)).toBe(true);
    });

    it('should handle negative energy values', () => {
      const reactions = [
        createReaction('fusion', ['A'], ['B'], -5.0, 0),
      ];

      const result = analyzePathways(reactions);

      expect(result[0].avgEnergy).toBe(-5.0);
      expect(result[0].totalEnergy).toBe(-5.0);
    });

    it('should handle very large frequency counts', () => {
      const reactions = Array(1000).fill(null).map((_, i) =>
        createReaction('fusion', ['H-1', 'H-1'], ['D-2'], 1.0, i)
      );

      const result = analyzePathways(reactions);

      expect(result).toHaveLength(1);
      expect(result[0].frequency).toBe(1000);
      expect(result[0].loops).toHaveLength(1000);
      expect(result[0].rarityScore).toBe(100);
    });
  });

  describe('filterPathways', () => {
    const mockPathways: PathwayAnalysis[] = [
      {
        pathway: 'H-1 + Li-7 → He-4 + He-4',
        type: 'fusion',
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4', 'He-4'],
        frequency: 10,
        avgEnergy: 17.3,
        totalEnergy: 173.0,
        loops: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        isFeedback: true,
        rarityScore: 100,
      },
      {
        pathway: 'D-2 + D-2 → He-3 + n',
        type: 'fusion',
        inputs: ['D-2', 'D-2'],
        outputs: ['He-3', 'n'],
        frequency: 5,
        avgEnergy: 3.27,
        totalEnergy: 16.35,
        loops: [0, 2, 4, 6, 8],
        isFeedback: false,
        rarityScore: 50,
      },
      {
        pathway: 'D-2 + Li-6 → He-4 + He-4',
        type: 'twotwo',
        inputs: ['D-2', 'Li-6'],
        outputs: ['He-4', 'He-4'],
        frequency: 3,
        avgEnergy: 22.4,
        totalEnergy: 67.2,
        loops: [1, 3, 5],
        isFeedback: false,
        rarityScore: 30,
      },
    ];

    it('should return all pathways with empty filter', () => {
      const result = filterPathways(mockPathways, {});

      expect(result).toHaveLength(3);
    });

    it('should filter by minimum frequency', () => {
      const result = filterPathways(mockPathways, { minFrequency: 5 });

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.frequency >= 5)).toBe(true);
    });

    it('should filter by minimum energy', () => {
      const result = filterPathways(mockPathways, { minEnergy: 10 });

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.avgEnergy >= 10)).toBe(true);
      expect(result.map((p) => p.pathway)).toContain('H-1 + Li-7 → He-4 + He-4');
      expect(result.map((p) => p.pathway)).toContain('D-2 + Li-6 → He-4 + He-4');
    });

    it('should filter by reaction type (fusion only)', () => {
      const result = filterPathways(mockPathways, {
        showFusion: true,
        showTwoToTwo: false,
      });

      expect(result).toHaveLength(2);
      expect(result.every((p) => p.type === 'fusion')).toBe(true);
    });

    it('should filter by reaction type (twotwo only)', () => {
      const result = filterPathways(mockPathways, {
        showFusion: false,
        showTwoToTwo: true,
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('twotwo');
    });

    it('should filter by feedback only', () => {
      const result = filterPathways(mockPathways, { feedbackOnly: true });

      expect(result).toHaveLength(1);
      expect(result[0].isFeedback).toBe(true);
      expect(result[0].pathway).toBe('H-1 + Li-7 → He-4 + He-4');
    });

    it('should filter by search term (input match)', () => {
      const result = filterPathways(mockPathways, { searchTerm: 'Li-7' });

      expect(result).toHaveLength(1);
      expect(result[0].inputs).toContain('Li-7');
    });

    it('should filter by search term (output match)', () => {
      const result = filterPathways(mockPathways, { searchTerm: 'He-3' });

      expect(result).toHaveLength(1);
      expect(result[0].outputs).toContain('He-3');
    });

    it('should filter by search term (case insensitive)', () => {
      const result = filterPathways(mockPathways, { searchTerm: 'he-4' });

      expect(result).toHaveLength(2);  // Two pathways produce He-4
    });

    it('should limit to max count (top N)', () => {
      const result = filterPathways(mockPathways, { maxCount: 2 });

      expect(result).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const result = filterPathways(mockPathways, {
        minFrequency: 3,
        showFusion: true,
        showTwoToTwo: false,
        maxCount: 1,
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('fusion');
      expect(result[0].frequency).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array if no pathways match', () => {
      const result = filterPathways(mockPathways, { searchTerm: 'Nonexistent' });

      expect(result).toEqual([]);
    });
  });

  describe('getPathwayStats', () => {
    it('should return zero stats for empty pathways', () => {
      const result = getPathwayStats([]);

      expect(result).toEqual({
        totalPathways: 0,
        totalReactions: 0,
        feedbackCount: 0,
        avgFrequency: 0,
        avgEnergy: 0,
        mostCommon: null,
        highestEnergy: null,
      });
    });

    it('should calculate statistics for single pathway', () => {
      const pathways: PathwayAnalysis[] = [
        {
          pathway: 'H-1 + Li-7 → He-4 + He-4',
          type: 'fusion',
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          frequency: 5,
          avgEnergy: 17.3,
          totalEnergy: 86.5,
          loops: [0, 1, 2, 3, 4],
          isFeedback: true,
          rarityScore: 100,
        },
      ];

      const result = getPathwayStats(pathways);

      expect(result).toMatchObject({
        totalPathways: 1,
        totalReactions: 5,
        feedbackCount: 1,
        avgFrequency: 5,
        avgEnergy: 17.3,
      });
      expect(result.mostCommon).toBe(pathways[0]);
      expect(result.highestEnergy).toBe(pathways[0]);
    });

    it('should calculate statistics for multiple pathways', () => {
      const pathways: PathwayAnalysis[] = [
        {
          pathway: 'A → B',
          type: 'fusion',
          inputs: ['A'],
          outputs: ['B'],
          frequency: 10,
          avgEnergy: 5.0,
          totalEnergy: 50.0,
          loops: [0],
          isFeedback: true,
          rarityScore: 100,
        },
        {
          pathway: 'C → D',
          type: 'fusion',
          inputs: ['C'],
          outputs: ['D'],
          frequency: 3,
          avgEnergy: 15.0,
          totalEnergy: 45.0,
          loops: [1],
          isFeedback: false,
          rarityScore: 30,
        },
        {
          pathway: 'E → F',
          type: 'twotwo',
          inputs: ['E'],
          outputs: ['F'],
          frequency: 7,
          avgEnergy: 10.0,
          totalEnergy: 70.0,
          loops: [2],
          isFeedback: true,
          rarityScore: 70,
        },
      ];

      const result = getPathwayStats(pathways);

      expect(result.totalPathways).toBe(3);
      expect(result.totalReactions).toBe(20);  // 10 + 3 + 7
      expect(result.feedbackCount).toBe(2);
      expect(result.avgFrequency).toBeCloseTo(6.667, 2);  // 20 / 3
      expect(result.avgEnergy).toBe(10);  // (5 + 15 + 10) / 3
    });

    it('should identify most common pathway', () => {
      const pathways: PathwayAnalysis[] = [
        {
          pathway: 'A → B',
          type: 'fusion',
          inputs: ['A'],
          outputs: ['B'],
          frequency: 5,
          avgEnergy: 10.0,
          totalEnergy: 50.0,
          loops: [0],
          isFeedback: false,
          rarityScore: 50,
        },
        {
          pathway: 'C → D',
          type: 'fusion',
          inputs: ['C'],
          outputs: ['D'],
          frequency: 15,
          avgEnergy: 8.0,
          totalEnergy: 120.0,
          loops: [1],
          isFeedback: false,
          rarityScore: 100,
        },
      ];

      const result = getPathwayStats(pathways);

      expect(result.mostCommon?.frequency).toBe(15);
      expect(result.mostCommon?.pathway).toBe('C → D');
    });

    it('should identify highest energy pathway', () => {
      const pathways: PathwayAnalysis[] = [
        {
          pathway: 'A → B',
          type: 'fusion',
          inputs: ['A'],
          outputs: ['B'],
          frequency: 10,
          avgEnergy: 5.0,
          totalEnergy: 50.0,
          loops: [0],
          isFeedback: false,
          rarityScore: 100,
        },
        {
          pathway: 'C → D',
          type: 'fusion',
          inputs: ['C'],
          outputs: ['D'],
          frequency: 2,
          avgEnergy: 25.0,
          totalEnergy: 50.0,
          loops: [1],
          isFeedback: false,
          rarityScore: 20,
        },
      ];

      const result = getPathwayStats(pathways);

      expect(result.highestEnergy?.avgEnergy).toBe(25.0);
      expect(result.highestEnergy?.pathway).toBe('C → D');
    });

    it('should count feedback pathways correctly', () => {
      const pathways: PathwayAnalysis[] = [
        {
          pathway: 'A → B',
          type: 'fusion',
          inputs: ['A'],
          outputs: ['B'],
          frequency: 1,
          avgEnergy: 1.0,
          totalEnergy: 1.0,
          loops: [0],
          isFeedback: true,
          rarityScore: 100,
        },
        {
          pathway: 'C → D',
          type: 'fusion',
          inputs: ['C'],
          outputs: ['D'],
          frequency: 1,
          avgEnergy: 1.0,
          totalEnergy: 1.0,
          loops: [1],
          isFeedback: false,
          rarityScore: 100,
        },
        {
          pathway: 'E → F',
          type: 'fusion',
          inputs: ['E'],
          outputs: ['F'],
          frequency: 1,
          avgEnergy: 1.0,
          totalEnergy: 1.0,
          loops: [2],
          isFeedback: true,
          rarityScore: 100,
        },
      ];

      const result = getPathwayStats(pathways);

      expect(result.feedbackCount).toBe(2);
    });
  });
});
