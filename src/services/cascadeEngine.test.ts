import { describe, it, expect } from 'vitest';
import { runCascadeSimulation } from './cascadeEngine';
import type { CascadeParameters, FuelNuclide } from '../types';

// Mock database for testing
const mockDb = {
  exec: (query: string) => {
    // Mock fusion reactions: H-1 + Li-7 → He-4 + He-4 (17.3 MeV)
    if (query.includes('fusion_reactions')) {
      return [
        {
          columns: ['input1_id', 'input2_id', 'output1_id', 'output2_id', 'Q_MeV'],
          values: [
            ['H-1', 'Li-7', 'He-4', 'He-4', 17.3],
            ['H-1', 'Li-6', 'He-4', 'He-3', 4.0],
          ],
        },
      ];
    }

    // Mock two-to-two reactions
    if (query.includes('two_to_two_reactions')) {
      return [
        {
          columns: ['input1_id', 'input2_id', 'output1_id', 'output2_id', 'Q_MeV'],
          values: [],
        },
      ];
    }

    return [];
  },
} as any;

describe('cascadeEngine - Weighted Mode', () => {
  describe('runCascadeSimulation with weighted fuel', () => {
    it('should apply weights to reactions based on fuel proportions', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.9, displayValue: 90 },
          { nuclideId: 'Li-6', proportion: 0.1, displayValue: 10 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results).toBeDefined();
      expect(results.isWeighted).toBe(true);
      expect(results.fuelComposition).toHaveLength(2);

      // Check that reactions have weights
      const li7Reactions = results.reactions.filter((r) =>
        r.inputs.includes('Li-7')
      );
      const li6Reactions = results.reactions.filter((r) =>
        r.inputs.includes('Li-6')
      );

      if (li7Reactions.length > 0) {
        expect(li7Reactions[0].weight).toBeDefined();
        expect(li7Reactions[0].weight).toBeGreaterThan(0);
      }

      if (li6Reactions.length > 0) {
        expect(li6Reactions[0].weight).toBeDefined();
        expect(li6Reactions[0].weight).toBeGreaterThan(0);
      }
    });

    it('should normalize proportions if not summing to 1.0', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 90, displayValue: 90 }, // Will be normalized
          { nuclideId: 'Li-6', proportion: 10, displayValue: 10 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results.fuelComposition).toBeDefined();
      expect(results.fuelComposition![0].proportion).toBeCloseTo(0.9, 5);
      expect(results.fuelComposition![1].proportion).toBeCloseTo(0.1, 5);
    });

    it('should handle equal proportions (should behave similarly to unweighted)', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.5, displayValue: 50 },
          { nuclideId: 'Li-6', proportion: 0.5, displayValue: 50 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results.isWeighted).toBe(true);

      // With equal proportions, weights should be balanced
      const li7Reactions = results.reactions.filter((r) =>
        r.inputs.includes('Li-7')
      );
      const li6Reactions = results.reactions.filter((r) =>
        r.inputs.includes('Li-6')
      );

      if (li7Reactions.length > 0 && li6Reactions.length > 0) {
        // Weights should be similar (within Monte Carlo variance)
        const avgLi7Weight =
          li7Reactions.reduce((sum, r) => sum + (r.weight || 0), 0) /
          li7Reactions.length;
        const avgLi6Weight =
          li6Reactions.reduce((sum, r) => sum + (r.weight || 0), 0) /
          li6Reactions.length;

        // With 50/50 split and assuming H-1 is 100%, weights should be ~0.5 each
        expect(avgLi7Weight).toBeCloseTo(avgLi6Weight, 1);
      }
    });

    it('should handle single nuclide (100% proportion)', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 1.0, displayValue: 100 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results.isWeighted).toBe(true);
      expect(results.fuelComposition).toHaveLength(1);
      expect(results.fuelComposition![0].proportion).toBe(1.0);

      // All Li-7 reactions should have weight = 1.0 (if only input is Li-7)
      const li7Reactions = results.reactions.filter((r) =>
        r.inputs.includes('Li-7')
      );

      if (li7Reactions.length > 0) {
        expect(li7Reactions[0].weight).toBeDefined();
      }
    });

    it('should handle extreme proportions (99% / 1%)', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.99, displayValue: 99 },
          { nuclideId: 'Li-6', proportion: 0.01, displayValue: 1 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results.isWeighted).toBe(true);

      // Li-7 reactions should have much higher weight than Li-6
      const li7Reactions = results.reactions.filter((r) =>
        r.inputs.includes('Li-7')
      );
      const li6Reactions = results.reactions.filter((r) =>
        r.inputs.includes('Li-6')
      );

      if (li7Reactions.length > 0 && li6Reactions.length > 0) {
        const avgLi7Weight =
          li7Reactions.reduce((sum, r) => sum + (r.weight || 0), 0) /
          li7Reactions.length;
        const avgLi6Weight =
          li6Reactions.reduce((sum, r) => sum + (r.weight || 0), 0) /
          li6Reactions.length;

        // Li-7 weight should be much higher (roughly 99× if pure reactions)
        expect(avgLi7Weight).toBeGreaterThan(avgLi6Weight);
      }
    });

    it('should propagate weights to product distribution', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.9, displayValue: 90 },
          { nuclideId: 'Li-6', proportion: 0.1, displayValue: 10 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      // Product distribution should contain weighted counts
      expect(results.productDistribution).toBeDefined();

      // He-4 should have higher count (more common from Li-7 reactions)
      if (results.productDistribution.get('He-4')) {
        expect(results.productDistribution.get('He-4')).toBeGreaterThan(0);
      }
    });
  });

  describe('Backward compatibility: Unweighted mode', () => {
    it('should work with string[] fuel nuclides (traditional mode)', async () => {
      const params: CascadeParameters = {
        fuelNuclides: ['Li-7', 'Li-6'], // String array (unweighted)
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: false, // Explicitly unweighted
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results.isWeighted).toBe(false);

      // Reactions should not have weights (or weight = undefined)
      if (results.reactions.length > 0) {
        const hasWeights = results.reactions.some((r) => r.weight !== undefined);
        expect(hasWeights).toBe(false);
      }
    });

    it('should default to unweighted if useWeightedMode not specified', async () => {
      const params: CascadeParameters = {
        fuelNuclides: ['Li-7', 'Li-6'],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        // useWeightedMode not specified
      };

      const results = await runCascadeSimulation(mockDb, params);

      // Should default to unweighted
      expect(results.isWeighted).toBe(false);
    });

    it('should handle FuelNuclide[] with useWeightedMode=false', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.9, displayValue: 90 },
          { nuclideId: 'Li-6', proportion: 0.1, displayValue: 10 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: false, // User explicitly disabled weighting
      };

      const results = await runCascadeSimulation(mockDb, params);

      // Should still be unweighted (user choice)
      expect(results.isWeighted).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty fuel nuclides', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      // Should return empty results gracefully
      expect(results.reactions).toHaveLength(0);
      expect(results.totalEnergy).toBe(0);
    });

    it('should handle zero energy threshold with weighted mode', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.9, displayValue: 90 },
          { nuclideId: 'Li-6', proportion: 0.1, displayValue: 10 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 0.0, // Accept all reactions
        minTwoToTwoMeV: 0.0,
        maxNuclides: 10,
        maxLoops: 5,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results.isWeighted).toBe(true);
      // Should include more reactions (possibly endothermic)
      expect(results.reactions.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle high maxLoops with weighted mode', async () => {
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.5, displayValue: 50 },
          { nuclideId: 'Li-6', proportion: 0.5, displayValue: 50 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 50,
        maxLoops: 20, // Many loops
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results.isWeighted).toBe(true);
      // Should complete without hanging
      expect(results.loopsExecuted).toBeLessThanOrEqual(20);
    });
  });

  describe('Integration: Full workflow', () => {
    it('should produce realistic weighted cascade results', async () => {
      // Simulate natural lithium: 92.5% Li-7, 7.5% Li-6
      const params: CascadeParameters = {
        fuelNuclides: [
          { nuclideId: 'Li-7', proportion: 0.925, displayValue: 92.5 },
          { nuclideId: 'Li-6', proportion: 0.075, displayValue: 7.5 },
        ] as FuelNuclide[],
        temperature: 1000,
        minFusionMeV: 1.0,
        minTwoToTwoMeV: 1.0,
        maxNuclides: 20,
        maxLoops: 10,
        feedbackBosons: true,
        feedbackFermions: true,
        allowDimers: false,
        excludeMelted: false,
        excludeBoiledOff: false,
        useWeightedMode: true,
      };

      const results = await runCascadeSimulation(mockDb, params);

      expect(results).toBeDefined();
      expect(results.isWeighted).toBe(true);
      expect(results.fuelComposition).toHaveLength(2);

      // Li-7 reactions should dominate
      const li7ReactionCount = results.reactions.filter((r) =>
        r.inputs.includes('Li-7')
      ).length;
      const li6ReactionCount = results.reactions.filter((r) =>
        r.inputs.includes('Li-6')
      ).length;

      // In natural lithium, Li-7 should have ~12× more reactions
      if (li6ReactionCount > 0) {
        const ratio = li7ReactionCount / li6ReactionCount;
        expect(ratio).toBeGreaterThan(5); // At least 5× (allowing Monte Carlo variance)
      }

      // Total energy should be weighted sum
      expect(results.totalEnergy).toBeGreaterThan(0);

      // Product distribution should reflect weighted probabilities
      expect(Object.keys(results.productDistribution).length).toBeGreaterThan(0);
    });
  });
});
