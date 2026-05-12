import { describe, it, expect } from 'vitest';
import {
  mockElements,
  mockNuclides,
  mockFusionReactions,
  mockFissionReactions,
  mockTwoToTwoReactions,
  filterByElement,
  getUniqueElements,
} from './mockData';

describe('mockData', () => {
  describe('data exports', () => {
    it('exports mockElements with expected structure', () => {
      expect(mockElements.length).toBeGreaterThan(0);
      const hydrogen = mockElements.find((e) => e.E === 'H');
      expect(hydrogen).toBeDefined();
      expect(hydrogen!.Z).toBe(1);
      expect(hydrogen!.EName).toBe('Hydrogen');
    });

    it('exports mockNuclides with expected structure', () => {
      expect(mockNuclides.length).toBeGreaterThan(0);
      const deuterium = mockNuclides.find((n) => n.E === 'D');
      expect(deuterium).toBeDefined();
      expect(deuterium!.Z).toBe(1);
      expect(deuterium!.A).toBe(2);
    });

    it('exports mockFusionReactions', () => {
      expect(mockFusionReactions.length).toBeGreaterThan(0);
      expect(mockFusionReactions[0]).toHaveProperty('MeV');
      expect(mockFusionReactions[0]).toHaveProperty('E1');
      expect(mockFusionReactions[0]).toHaveProperty('E2');
    });

    it('exports mockFissionReactions', () => {
      expect(mockFissionReactions.length).toBeGreaterThan(0);
      expect(mockFissionReactions[0]).toHaveProperty('E');
      expect(mockFissionReactions[0]).toHaveProperty('E1');
      expect(mockFissionReactions[0]).toHaveProperty('E2');
    });

    it('exports mockTwoToTwoReactions', () => {
      expect(mockTwoToTwoReactions.length).toBeGreaterThan(0);
      expect(mockTwoToTwoReactions[0]).toHaveProperty('E3');
      expect(mockTwoToTwoReactions[0]).toHaveProperty('E4');
    });
  });

  describe('filterByElement', () => {
    it('filters fusion reactions by E1', () => {
      const results = filterByElement(mockFusionReactions, 'H');
      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(
          r.E === 'H' || r.E1 === 'H' || r.E2 === 'H',
        ).toBe(true);
      });
    });

    it('filters fusion reactions by output element', () => {
      const results = filterByElement(mockFusionReactions, 'He');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for non-matching element', () => {
      const results = filterByElement(mockFusionReactions, 'Og');
      expect(results).toEqual([]);
    });

    it('filters fission reactions', () => {
      const results = filterByElement(mockFissionReactions, 'Pb');
      expect(results.length).toBe(1);
    });

    it('filters two-to-two reactions by E3 or E4', () => {
      const results = filterByElement(mockTwoToTwoReactions, 'Cr');
      expect(results.length).toBe(1);
    });
  });

  describe('getUniqueElements', () => {
    it('returns sorted unique elements from fusion reactions', () => {
      const elements = getUniqueElements(mockFusionReactions);
      expect(elements).toContain('H');
      expect(elements).toContain('D');
      expect(elements).toContain('He');
      // Should be sorted alphabetically
      expect(elements).toEqual([...elements].sort());
    });

    it('returns sorted unique elements from two-to-two reactions', () => {
      const elements = getUniqueElements(mockTwoToTwoReactions);
      expect(elements).toContain('H');
      expect(elements).toContain('Ni');
      expect(elements).toContain('Li');
      expect(elements).toContain('Cr');
    });

    it('returns empty array for empty input', () => {
      const elements = getUniqueElements([]);
      expect(elements).toEqual([]);
    });

    it('deduplicates elements that appear in multiple fields', () => {
      // H appears as both E1 in fusion and E1 in twotwo
      const allReactions = [...mockFusionReactions, ...mockTwoToTwoReactions];
      const elements = getUniqueElements(allReactions);
      const hCount = elements.filter((e) => e === 'H').length;
      expect(hCount).toBe(1);
    });
  });
});
