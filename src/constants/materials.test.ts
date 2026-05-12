import { describe, it, expect } from 'vitest';
import { NATURAL_ABUNDANCES, ALLOYS, COMPOUNDS, LENR_EXPERIMENTS, ALL_BUILTIN_MATERIALS, getMaterialsByCategory, getMaterialById } from './materials';

describe('materials catalog', () => {
  describe('NATURAL_ABUNDANCES', () => {
    it('includes lithium and nickel', () => {
      const lithium = NATURAL_ABUNDANCES.find(m => m.id === 'natural-lithium');
      expect(lithium).toBeDefined();
      expect(lithium!.composition.length).toBeGreaterThan(0);

      const nickel = NATURAL_ABUNDANCES.find(m => m.id === 'natural-nickel');
      expect(nickel).toBeDefined();
    });

    it('all materials have valid composition', () => {
      NATURAL_ABUNDANCES.forEach(material => {
        expect(material.id).toBeTruthy();
        expect(material.name).toBeTruthy();
        expect(material.category).toBe('natural-abundance');
        expect(material.composition.length).toBeGreaterThan(0);
        material.composition.forEach(comp => {
          expect(comp.nuclideId).toBeTruthy();
          expect(comp.proportion).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('ALL_BUILTIN_MATERIALS', () => {
    it('combines all material categories', () => {
      const totalExpected = NATURAL_ABUNDANCES.length + ALLOYS.length + COMPOUNDS.length + LENR_EXPERIMENTS.length;
      expect(ALL_BUILTIN_MATERIALS.length).toBe(totalExpected);
    });

    it('all materials have unique IDs', () => {
      const ids = ALL_BUILTIN_MATERIALS.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getMaterialsByCategory', () => {
    it('returns materials matching category', () => {
      const natural = getMaterialsByCategory('natural-abundance');
      expect(natural.length).toBe(NATURAL_ABUNDANCES.length);
    });

    it('returns empty for unknown category', () => {
      expect(getMaterialsByCategory('nonexistent')).toEqual([]);
    });
  });

  describe('getMaterialById', () => {
    it('finds material by id', () => {
      const lithium = getMaterialById('natural-lithium');
      expect(lithium).toBeDefined();
      expect(lithium!.name).toBe('Natural Lithium');
    });

    it('returns undefined for unknown id', () => {
      expect(getMaterialById('does-not-exist')).toBeUndefined();
    });
  });

  describe('LENR_EXPERIMENTS', () => {
    it('includes historical experiments', () => {
      expect(LENR_EXPERIMENTS.length).toBeGreaterThan(0);
      LENR_EXPERIMENTS.forEach(exp => {
        expect(exp.category).toBe('lenr-experiment');
        expect(exp.composition.length).toBeGreaterThan(0);
      });
    });
  });
});
