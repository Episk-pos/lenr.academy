import { describe, it, expect } from 'vitest';
import {
  validateProportions,
  normalizeProportions,
  atomicRatioToPercentage,
  createEqualProportions,
  mergeWeightedNuclides,
  formatProportion,
  getFormatLabel,
  getFormatHelpText,
  convertFormat,
} from './proportionService';
import type { ProportionInput } from './proportionService';
import type { WeightedNuclide } from '../types';

describe('proportionService', () => {
  describe('validateProportions', () => {
    it('rejects empty inputs', () => {
      const result = validateProportions([], 'percentage');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('At least one');
    });

    it('accepts valid percentage inputs', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 75 },
        { nuclideId: 'Li-6', value: 25 },
      ];
      const result = validateProportions(inputs, 'percentage');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid nuclide notation', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'invalid', value: 50 },
      ];
      const result = validateProportions(inputs, 'percentage');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid nuclide notation');
    });

    it('rejects NaN values', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: NaN },
      ];
      const result = validateProportions(inputs, 'percentage');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('must be a number');
    });

    it('rejects negative values', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: -5 },
      ];
      const result = validateProportions(inputs, 'percentage');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('negative'))).toBe(true);
    });

    it('rejects percentage > 100', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 150 },
      ];
      const result = validateProportions(inputs, 'percentage');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('exceed 100'))).toBe(true);
    });

    it('allows values > 100 for atomic-ratio format', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 200 },
        { nuclideId: 'Li-6', value: 100 },
      ];
      const result = validateProportions(inputs, 'atomic-ratio');
      expect(result.isValid).toBe(true);
    });

    it('detects duplicate nuclides', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 50 },
        { nuclideId: 'Li-7', value: 30 },
      ];
      const result = validateProportions(inputs, 'percentage');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);
    });

    it('rejects zero total', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 0 },
        { nuclideId: 'Li-6', value: 0 },
      ];
      const result = validateProportions(inputs, 'percentage');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('cannot be zero'))).toBe(true);
    });
  });

  describe('normalizeProportions', () => {
    it('normalizes to 100%', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 3 },
        { nuclideId: 'Li-6', value: 1 },
      ];
      const result = normalizeProportions(inputs);
      expect(result[0].proportion).toBe(75);
      expect(result[1].proportion).toBe(25);
      expect(result[0].nuclideId).toBe('Li-7');
    });

    it('distributes equally when all zeros', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 0 },
        { nuclideId: 'Li-6', value: 0 },
      ];
      const result = normalizeProportions(inputs);
      expect(result[0].proportion).toBe(50);
      expect(result[1].proportion).toBe(50);
    });

    it('preserves already-normalized percentages', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Ni-58', value: 68.08 },
        { nuclideId: 'Ni-60', value: 26.22 },
        { nuclideId: 'Ni-62', value: 5.7 },
      ];
      const result = normalizeProportions(inputs);
      const total = result.reduce((sum, r) => sum + r.proportion, 0);
      expect(total).toBeCloseTo(100, 5);
    });

    it('sets sourceType on all results', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 50 },
      ];
      const result = normalizeProportions(inputs, 'natural');
      expect(result[0].sourceType).toBe('natural');
    });
  });

  describe('atomicRatioToPercentage', () => {
    it('converts 3:1 ratio to 75%:25%', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 3 },
        { nuclideId: 'Li-6', value: 1 },
      ];
      const result = atomicRatioToPercentage(inputs);
      expect(result[0].proportion).toBe(75);
      expect(result[1].proportion).toBe(25);
    });

    it('converts 1:1:1 to equal thirds', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'H-1', value: 1 },
        { nuclideId: 'D-2', value: 1 },
        { nuclideId: 'T-3', value: 1 },
      ];
      const result = atomicRatioToPercentage(inputs);
      result.forEach((r) => expect(r.proportion).toBeCloseTo(33.333, 2));
    });
  });

  describe('createEqualProportions', () => {
    it('creates equal proportions for given nuclide IDs', () => {
      const result = createEqualProportions(['Li-7', 'Li-6', 'Li-8']);
      expect(result).toHaveLength(3);
      result.forEach((r) => expect(r.proportion).toBeCloseTo(33.333, 2));
    });

    it('returns empty array for empty input', () => {
      expect(createEqualProportions([])).toEqual([]);
    });

    it('returns 100% for single nuclide', () => {
      const result = createEqualProportions(['Li-7']);
      expect(result[0].proportion).toBe(100);
    });

    it('sets sourceType', () => {
      const result = createEqualProportions(['Li-7'], 'material');
      expect(result[0].sourceType).toBe('material');
    });
  });

  describe('mergeWeightedNuclides', () => {
    it('merges and re-normalizes', () => {
      const a: WeightedNuclide[] = [
        { nuclideId: 'Li-7', proportion: 50, sourceType: 'manual' },
      ];
      const b: WeightedNuclide[] = [
        { nuclideId: 'Li-7', proportion: 50, sourceType: 'manual' },
      ];
      const result = mergeWeightedNuclides(a, b);
      expect(result).toHaveLength(1);
      expect(result[0].proportion).toBe(100);
    });

    it('combines different nuclides', () => {
      const a: WeightedNuclide[] = [
        { nuclideId: 'Li-7', proportion: 60, sourceType: 'manual' },
      ];
      const b: WeightedNuclide[] = [
        { nuclideId: 'Ni-58', proportion: 40, sourceType: 'manual' },
      ];
      const result = mergeWeightedNuclides(a, b);
      expect(result).toHaveLength(2);
      expect(result[0].proportion).toBe(60);
      expect(result[1].proportion).toBe(40);
    });

    it('handles empty arrays', () => {
      const result = mergeWeightedNuclides([], []);
      expect(result).toEqual([]);
    });

    it('merges multiple arrays', () => {
      const a: WeightedNuclide[] = [
        { nuclideId: 'Li-7', proportion: 30, sourceType: 'manual' },
      ];
      const b: WeightedNuclide[] = [
        { nuclideId: 'Li-6', proportion: 20, sourceType: 'manual' },
      ];
      const c: WeightedNuclide[] = [
        { nuclideId: 'Ni-58', proportion: 50, sourceType: 'manual' },
      ];
      const result = mergeWeightedNuclides(a, b, c);
      expect(result).toHaveLength(3);
      const total = result.reduce((sum, r) => sum + r.proportion, 0);
      expect(total).toBeCloseTo(100, 5);
    });
  });

  describe('formatProportion', () => {
    it('formats >= 10 with 1 decimal', () => {
      expect(formatProportion(68.08)).toBe('68.1%');
    });

    it('formats >= 1 with 2 decimals', () => {
      expect(formatProportion(3.63)).toBe('3.63%');
    });

    it('formats >= 0.01 with 3 decimals', () => {
      expect(formatProportion(0.093)).toBe('0.093%');
    });

    it('formats >= 0.001 with 4 decimals', () => {
      expect(formatProportion(0.0012)).toBe('0.0012%');
    });

    it('formats very small values with 5 decimals', () => {
      expect(formatProportion(0.00005)).toBe('0.00005%');
    });

    it('formats zero', () => {
      expect(formatProportion(0)).toBe('0%');
    });

    it('formats 100', () => {
      expect(formatProportion(100)).toBe('100.0%');
    });
  });

  describe('getFormatLabel', () => {
    it('returns correct labels', () => {
      expect(getFormatLabel('percentage')).toContain('Percentage');
      expect(getFormatLabel('atomic-ratio')).toContain('Atomic');
      expect(getFormatLabel('mass-ratio')).toContain('Mass');
    });
  });

  describe('getFormatHelpText', () => {
    it('returns help text for each format', () => {
      expect(getFormatHelpText('percentage')).toContain('0-100');
      expect(getFormatHelpText('atomic-ratio')).toContain('ratios');
      expect(getFormatHelpText('mass-ratio')).toContain('grams');
    });
  });

  describe('convertFormat', () => {
    it('converts percentage to percentage (normalizes)', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 60 },
        { nuclideId: 'Li-6', value: 40 },
      ];
      const result = convertFormat(inputs, 'percentage', 'percentage');
      expect(result[0].proportion).toBe(60);
      expect(result[1].proportion).toBe(40);
    });

    it('converts atomic-ratio to percentage', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 3 },
        { nuclideId: 'Li-6', value: 1 },
      ];
      const result = convertFormat(inputs, 'atomic-ratio', 'percentage');
      expect(result[0].proportion).toBe(75);
      expect(result[1].proportion).toBe(25);
    });

    it('throws when mass-ratio conversion lacks db', () => {
      const inputs: ProportionInput[] = [
        { nuclideId: 'Li-7', value: 7 },
      ];
      expect(() => convertFormat(inputs, 'mass-ratio', 'percentage')).toThrow(
        'Database required',
      );
    });
  });
});
