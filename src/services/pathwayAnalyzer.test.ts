import { describe, it, expect } from 'vitest';
import { analyzePathways } from './pathwayAnalyzer';

describe('pathwayAnalyzer - Weighted Mode', () => {
  describe('analyzePathways with weights', () => {
    it('should aggregate weighted frequencies correctly', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.9, // 90% probability
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-6'],
          outputs: ['He-4', 'He-3'],
          MeV: 4.0,
          loop: 0,
          weight: 0.1, // 10% probability
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(2);

      const li7Pathway = pathways.find((p) => p.inputs.includes('Li-7'));
      const li6Pathway = pathways.find((p) => p.inputs.includes('Li-6'));

      expect(li7Pathway).toBeDefined();
      expect(li6Pathway).toBeDefined();

      // Frequencies should reflect weights
      expect(li7Pathway!.frequency).toBeCloseTo(0.9, 5);
      expect(li6Pathway!.frequency).toBeCloseTo(0.1, 5);

      // Energy should be weighted
      expect(li7Pathway!.totalEnergy).toBeCloseTo(17.3 * 0.9, 2);
      expect(li6Pathway!.totalEnergy).toBeCloseTo(4.0 * 0.1, 2);
    });

    it('should accumulate multiple weighted occurrences', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.9,
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 1,
          weight: 0.9,
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 2,
          weight: 0.9,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);

      const pathway = pathways[0];
      // Frequency should be sum of weights: 0.9 + 0.9 + 0.9 = 2.7
      expect(pathway.frequency).toBeCloseTo(2.7, 5);
      // Energy should be weighted sum
      expect(pathway.totalEnergy).toBeCloseTo(17.3 * 2.7, 2);
    });

    it('should handle unweighted reactions (weight undefined)', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          // No weight → defaults to 1.0
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 1,
          // No weight → defaults to 1.0
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);

      const pathway = pathways[0];
      // Frequency should be count: 2
      expect(pathway.frequency).toBe(2);
      expect(pathway.totalEnergy).toBeCloseTo(17.3 * 2, 2);
    });

    it('should handle mixed weighted and unweighted reactions', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.5,
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 1,
          // No weight → defaults to 1.0
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);

      const pathway = pathways[0];
      // Frequency = 0.5 + 1.0 = 1.5
      expect(pathway.frequency).toBeCloseTo(1.5, 5);
    });

    it('should handle very small weights', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.001,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);
      expect(pathways[0].frequency).toBeCloseTo(0.001, 5);
      expect(pathways[0].totalEnergy).toBeCloseTo(17.3 * 0.001, 5);
    });

    it('should handle zero weights', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.0,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);
      expect(pathways[0].frequency).toBe(0);
      expect(pathways[0].totalEnergy).toBe(0);
    });

    it('should calculate weighted avgEnergy correctly', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.9,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);

      const pathway = pathways[0];
      // avgEnergy = totalEnergy / frequency = (17.3 * 0.9) / 0.9 = 17.3
      expect(pathway.avgEnergy).toBeCloseTo(17.3, 2);
    });

    it('should handle different pathways with different weights', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.81, // 90% Li-7 × 90% Li-7 (if self-reaction)
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-6'],
          outputs: ['He-4', 'He-3'],
          MeV: 4.0,
          loop: 0,
          weight: 0.09, // 90% × 10%
        },
        {
          type: 'fusion' as const,
          inputs: ['Li-7', 'Li-6'],
          outputs: ['Be-13'],
          MeV: 5.0,
          loop: 0,
          weight: 0.09, // 90% × 10%
        },
        {
          type: 'fusion' as const,
          inputs: ['Li-6', 'Li-6'],
          outputs: ['C-12'],
          MeV: 6.0,
          loop: 0,
          weight: 0.01, // 10% × 10%
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(4);

      // Sort by frequency descending
      pathways.sort((a, b) => b.frequency - a.frequency);

      // Most common should be Li-7 reactions (0.81)
      expect(pathways[0].frequency).toBeCloseTo(0.81, 5);

      // Next should be Li-7 × Li-6 reactions (0.09)
      expect(pathways[1].frequency).toBeCloseTo(0.09, 5);
      expect(pathways[2].frequency).toBeCloseTo(0.09, 5);

      // Least common should be Li-6 × Li-6 (0.01)
      expect(pathways[3].frequency).toBeCloseTo(0.01, 5);
    });

    it('should handle two-to-two reactions with weights', () => {
      const reactions = [
        {
          type: 'twotwo' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['D-2', 'Li-6'],
          MeV: 2.5,
          loop: 0,
          weight: 0.3,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);
      expect(pathways[0].frequency).toBeCloseTo(0.3, 5);
      expect(pathways[0].type).toBe('twotwo');
    });

    it('should identify feedback loops correctly with weighted reactions', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.9,
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'He-4'], // He-4 from previous reaction
          outputs: ['Li-5'],
          MeV: 5.0,
          loop: 1,
          weight: 0.5,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(2);

      // First pathway should not have feedback
      const firstPathway = pathways.find((p) => p.inputs.includes('Li-7'));
      expect(firstPathway!.isFeedback).toBe(false);

      // Second pathway should have feedback (He-4 is output in loop 0, input in loop 1)
      const secondPathway = pathways.find((p) => p.inputs.includes('He-4'));
      expect(secondPathway!.isFeedback).toBe(true);
    });

    it('should calculate rarity scores based on weighted frequencies', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.9, // Most common
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-6'],
          outputs: ['He-4', 'He-3'],
          MeV: 4.0,
          loop: 0,
          weight: 0.1, // Least common
        },
      ];

      const pathways = analyzePathways(reactions);

      const li7Pathway = pathways.find((p) => p.inputs.includes('Li-7'));
      const li6Pathway = pathways.find((p) => p.inputs.includes('Li-6'));

      // Li-7 pathway should have higher rarity score (more common = higher score)
      expect(li7Pathway!.rarityScore).toBeGreaterThan(li6Pathway!.rarityScore);

      // Most common should be 100
      expect(li7Pathway!.rarityScore).toBe(100);
    });
  });

  describe('Backward compatibility', () => {
    it('should work identically for unweighted reactions', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 1,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);
      // Should count as 2 occurrences (traditional behavior)
      expect(pathways[0].frequency).toBe(2);
      expect(pathways[0].totalEnergy).toBeCloseTo(17.3 * 2, 2);
      expect(pathways[0].avgEnergy).toBeCloseTo(17.3, 2);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty reactions array', () => {
      const reactions: any[] = [];
      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(0);
    });

    it('should handle single weighted reaction', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.42,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);
      expect(pathways[0].frequency).toBeCloseTo(0.42, 5);
      expect(pathways[0].rarityScore).toBe(100); // Only pathway = 100 score
    });

    it('should handle reactions across multiple loops', () => {
      const reactions = [
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 0,
          weight: 0.9,
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 5,
          weight: 0.9,
        },
        {
          type: 'fusion' as const,
          inputs: ['H-1', 'Li-7'],
          outputs: ['He-4', 'He-4'],
          MeV: 17.3,
          loop: 10,
          weight: 0.9,
        },
      ];

      const pathways = analyzePathways(reactions);

      expect(pathways).toHaveLength(1);
      expect(pathways[0].frequency).toBeCloseTo(2.7, 5); // 0.9 × 3
      expect(pathways[0].loops).toEqual([0, 5, 10]);
    });
  });
});
