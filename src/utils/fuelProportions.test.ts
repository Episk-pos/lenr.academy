import { describe, it, expect } from 'vitest';
import {
  normalizeFuelProportions,
  calculateReactionWeight,
  createEqualProportionFuel,
  type FuelNuclide,
} from './fuelProportions';

describe('fuelProportions', () => {
  describe('normalizeFuelProportions', () => {
    it('should normalize string array to equal proportions', () => {
      const input = ['H-1', 'D-2', 'T-3'];
      const result = normalizeFuelProportions(input);

      expect(result).toHaveLength(3);
      expect(result[0].nuclideId).toBe('H-1');
      expect(result[0].proportion).toBeCloseTo(0.333, 2);
      expect(result[1].nuclideId).toBe('D-2');
      expect(result[1].proportion).toBeCloseTo(0.333, 2);
      expect(result[2].nuclideId).toBe('T-3');
      expect(result[2].proportion).toBeCloseTo(0.333, 2);

      // Sum should be 1.0
      const sum = result.reduce((acc, fn) => acc + fn.proportion, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should normalize FuelNuclide array with proportions summing to 1.0', () => {
      const input: FuelNuclide[] = [
        { nuclideId: 'Li-7', proportion: 0.9, displayValue: 90 },
        { nuclideId: 'Li-6', proportion: 0.1, displayValue: 10 },
      ];
      const result = normalizeFuelProportions(input);

      expect(result).toHaveLength(2);
      expect(result[0].proportion).toBeCloseTo(0.9, 5);
      expect(result[1].proportion).toBeCloseTo(0.1, 5);

      const sum = result.reduce((acc, fn) => acc + fn.proportion, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should normalize FuelNuclide array with proportions NOT summing to 1.0', () => {
      const input: FuelNuclide[] = [
        { nuclideId: 'Li-7', proportion: 90, displayValue: 90 },
        { nuclideId: 'Li-6', proportion: 10, displayValue: 10 },
      ];
      const result = normalizeFuelProportions(input);

      expect(result).toHaveLength(2);
      expect(result[0].proportion).toBeCloseTo(0.9, 5);
      expect(result[1].proportion).toBeCloseTo(0.1, 5);

      const sum = result.reduce((acc, fn) => acc + fn.proportion, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should handle single nuclide (100% proportion)', () => {
      const input = ['H-1'];
      const result = normalizeFuelProportions(input);

      expect(result).toHaveLength(1);
      expect(result[0].nuclideId).toBe('H-1');
      expect(result[0].proportion).toBe(1.0);
    });

    it('should handle extreme proportions (99% and 1%)', () => {
      const input: FuelNuclide[] = [
        { nuclideId: 'Li-7', proportion: 0.99, displayValue: 99 },
        { nuclideId: 'Li-6', proportion: 0.01, displayValue: 1 },
      ];
      const result = normalizeFuelProportions(input);

      expect(result[0].proportion).toBeCloseTo(0.99, 5);
      expect(result[1].proportion).toBeCloseTo(0.01, 5);

      const sum = result.reduce((acc, fn) => acc + fn.proportion, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should preserve displayValue when provided', () => {
      const input: FuelNuclide[] = [
        { nuclideId: 'Li-7', proportion: 0.7, displayValue: 70 },
        { nuclideId: 'Li-6', proportion: 0.3, displayValue: 30 },
      ];
      const result = normalizeFuelProportions(input);

      expect(result[0].displayValue).toBe(70);
      expect(result[1].displayValue).toBe(30);
    });

    it('should handle zero proportions by filtering them out', () => {
      const input: FuelNuclide[] = [
        { nuclideId: 'Li-7', proportion: 0.9, displayValue: 90 },
        { nuclideId: 'Li-6', proportion: 0.0, displayValue: 0 },
        { nuclideId: 'B-11', proportion: 0.1, displayValue: 10 },
      ];
      const result = normalizeFuelProportions(input);

      // Should only have non-zero proportions
      expect(result).toHaveLength(2);
      expect(result.find((fn) => fn.nuclideId === 'Li-6')).toBeUndefined();

      // Renormalize remaining
      expect(result[0].proportion).toBeCloseTo(0.9, 5);
      expect(result[1].proportion).toBeCloseTo(0.1, 5);
    });
  });

  describe('calculateReactionWeight', () => {
    it('should calculate weight for single-input fusion reaction', () => {
      const reaction = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4', 'He-4'],
      };

      const proportions = new Map([
        ['H-1', 0.5],
        ['Li-7', 0.5],
      ]);

      const weight = calculateReactionWeight(reaction, proportions);

      // Weight = 0.5 × 0.5 = 0.25
      expect(weight).toBeCloseTo(0.25, 5);
    });

    it('should calculate weight for unequal proportions', () => {
      const reaction = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4', 'He-4'],
      };

      const proportions = new Map([
        ['H-1', 0.1],
        ['Li-7', 0.9],
      ]);

      const weight = calculateReactionWeight(reaction, proportions);

      // Weight = 0.1 × 0.9 = 0.09
      expect(weight).toBeCloseTo(0.09, 5);
    });

    it('should calculate weight for two-to-two reaction', () => {
      const reaction = {
        type: 'twotwo' as const,
        inputs: ['H-1', 'Li-7'],
        outputs: ['D-2', 'Li-6'],
      };

      const proportions = new Map([
        ['H-1', 0.3],
        ['Li-7', 0.7],
      ]);

      const weight = calculateReactionWeight(reaction, proportions);

      // Weight = 0.3 × 0.7 = 0.21
      expect(weight).toBeCloseTo(0.21, 5);
    });

    it('should return 1.0 if input not in proportions map', () => {
      const reaction = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Unknown-99'],
        outputs: ['He-4'],
      };

      const proportions = new Map([['H-1', 0.5]]);

      const weight = calculateReactionWeight(reaction, proportions);

      // Unknown-99 not in map → defaults to 1.0
      // Weight = 0.5 × 1.0 = 0.5
      expect(weight).toBeCloseTo(0.5, 5);
    });

    it('should handle 100% single nuclide', () => {
      const reaction = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4', 'He-4'],
      };

      const proportions = new Map([
        ['H-1', 1.0],
        ['Li-7', 0.0],
      ]);

      const weight = calculateReactionWeight(reaction, proportions);

      // Weight = 1.0 × 0.0 = 0.0
      expect(weight).toBe(0.0);
    });

    it('should handle extreme proportions', () => {
      const reaction = {
        type: 'fusion' as const,
        inputs: ['Li-7', 'Li-6'],
        outputs: ['Be-13'],
      };

      const proportions = new Map([
        ['Li-7', 0.99],
        ['Li-6', 0.01],
      ]);

      const weight = calculateReactionWeight(reaction, proportions);

      // Weight = 0.99 × 0.01 = 0.0099
      expect(weight).toBeCloseTo(0.0099, 5);
    });

    it('should handle equal proportions', () => {
      const reaction = {
        type: 'fusion' as const,
        inputs: ['H-1', 'D-2'],
        outputs: ['He-3'],
      };

      const proportions = new Map([
        ['H-1', 0.5],
        ['D-2', 0.5],
      ]);

      const weight = calculateReactionWeight(reaction, proportions);

      // Weight = 0.5 × 0.5 = 0.25
      expect(weight).toBeCloseTo(0.25, 5);
    });
  });

  describe('createEqualProportionFuel', () => {
    it('should create equal proportions for multiple nuclides', () => {
      const nuclideIds = ['H-1', 'D-2', 'T-3'];
      const result = createEqualProportionFuel(nuclideIds);

      expect(result).toHaveLength(3);
      expect(result[0].proportion).toBeCloseTo(0.333, 2);
      expect(result[1].proportion).toBeCloseTo(0.333, 2);
      expect(result[2].proportion).toBeCloseTo(0.333, 2);

      const sum = result.reduce((acc, fn) => acc + fn.proportion, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should create 100% proportion for single nuclide', () => {
      const nuclideIds = ['H-1'];
      const result = createEqualProportionFuel(nuclideIds);

      expect(result).toHaveLength(1);
      expect(result[0].nuclideId).toBe('H-1');
      expect(result[0].proportion).toBe(1.0);
    });

    it('should handle two nuclides (50/50 split)', () => {
      const nuclideIds = ['Li-7', 'Li-6'];
      const result = createEqualProportionFuel(nuclideIds);

      expect(result).toHaveLength(2);
      expect(result[0].proportion).toBe(0.5);
      expect(result[1].proportion).toBe(0.5);
    });

    it('should return empty array for empty input', () => {
      const nuclideIds: string[] = [];
      const result = createEqualProportionFuel(nuclideIds);

      expect(result).toHaveLength(0);
    });
  });

  describe('Integration: Full Workflow', () => {
    it('should normalize → calculate weights correctly', () => {
      // Step 1: Normalize fuel proportions
      const fuelInput: FuelNuclide[] = [
        { nuclideId: 'Li-7', proportion: 90, displayValue: 90 },
        { nuclideId: 'Li-6', proportion: 10, displayValue: 10 },
      ];
      const normalized = normalizeFuelProportions(fuelInput);

      // Step 2: Build proportions map
      const proportions = new Map(
        normalized.map((fn) => [fn.nuclideId, fn.proportion])
      );

      // Step 3: Calculate reaction weights
      const reaction1 = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4', 'He-4'],
      };
      const reaction2 = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Li-6'],
        outputs: ['He-4', 'He-3'],
      };

      proportions.set('H-1', 1.0); // Add H-1 for reaction

      const weight1 = calculateReactionWeight(reaction1, proportions);
      const weight2 = calculateReactionWeight(reaction2, proportions);

      // Weight1 = 1.0 × 0.9 = 0.9
      expect(weight1).toBeCloseTo(0.9, 5);
      // Weight2 = 1.0 × 0.1 = 0.1
      expect(weight2).toBeCloseTo(0.1, 5);

      // Ratio should be 9:1
      expect(weight1 / weight2).toBeCloseTo(9.0, 1);
    });

    it('should handle natural isotope abundances', () => {
      // Natural lithium: 92.5% Li-7, 7.5% Li-6
      const naturalLi: FuelNuclide[] = [
        { nuclideId: 'Li-7', proportion: 0.925, displayValue: 92.5 },
        { nuclideId: 'Li-6', proportion: 0.075, displayValue: 7.5 },
      ];

      const normalized = normalizeFuelProportions(naturalLi);
      expect(normalized[0].proportion).toBeCloseTo(0.925, 5);
      expect(normalized[1].proportion).toBeCloseTo(0.075, 5);

      const proportions = new Map(
        normalized.map((fn) => [fn.nuclideId, fn.proportion])
      );
      proportions.set('H-1', 1.0);

      const reactionLi7 = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Li-7'],
        outputs: ['He-4', 'He-4'],
      };
      const reactionLi6 = {
        type: 'fusion' as const,
        inputs: ['H-1', 'Li-6'],
        outputs: ['He-4', 'He-3'],
      };

      const weightLi7 = calculateReactionWeight(reactionLi7, proportions);
      const weightLi6 = calculateReactionWeight(reactionLi6, proportions);

      // Li-7 reactions should be ~12.3× more common than Li-6
      expect(weightLi7).toBeCloseTo(0.925, 5);
      expect(weightLi6).toBeCloseTo(0.075, 5);
      expect(weightLi7 / weightLi6).toBeCloseTo(12.33, 1);
    });
  });
});
