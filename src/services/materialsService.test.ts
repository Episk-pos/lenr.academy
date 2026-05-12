import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCustomMaterials,
  saveCustomMaterial,
  updateCustomMaterial,
  deleteCustomMaterial,
  getAllMaterials,
  getMaterialsByCategory,
  getMaterialById,
  getNaturalAbundanceMaterials,
  getAlloyMaterials,
  getCompoundMaterials,
  getLENRExperimentMaterials,
  searchMaterials,
  filterMaterials,
  materialToWeightedNuclides,
  createMaterialFromWeightedNuclides,
  getMaterialsCatalogStats,
  getAllMaterialTags,
} from './materialsService';
import type { Material, WeightedNuclide } from '../types';

describe('materialsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ===== Custom Materials CRUD =====

  describe('getCustomMaterials', () => {
    it('returns empty array when no custom materials', () => {
      expect(getCustomMaterials()).toEqual([]);
    });

    it('returns saved custom materials', () => {
      const materials: Material[] = [
        {
          id: 'custom-1',
          name: 'Test Material',
          category: 'custom',
          description: 'Test',
          composition: [{ nuclideId: 'Li-7', proportion: 100 }],
          isCustom: true,
        },
      ];
      localStorage.setItem('lenr-custom-materials', JSON.stringify(materials));
      expect(getCustomMaterials()).toHaveLength(1);
      expect(getCustomMaterials()[0].name).toBe('Test Material');
    });

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem('lenr-custom-materials', 'not-json');
      expect(getCustomMaterials()).toEqual([]);
    });
  });

  describe('saveCustomMaterial', () => {
    it('saves a new custom material with generated ID', () => {
      const result = saveCustomMaterial({
        name: 'My Alloy',
        category: 'custom',
        description: 'A custom alloy',
        composition: [
          { nuclideId: 'Ni-58', proportion: 68 },
          { nuclideId: 'Ni-60', proportion: 32 },
        ],
      });

      expect(result.id).toMatch(/^custom-\d+$/);
      expect(result.isCustom).toBe(true);
      expect(result.createdAt).toBeDefined();
      expect(result.name).toBe('My Alloy');

      // Verify persisted
      const stored = getCustomMaterials();
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe(result.id);
    });

    it('appends to existing custom materials', () => {
      saveCustomMaterial({
        name: 'First',
        category: 'custom',
        description: '',
        composition: [{ nuclideId: 'Li-7', proportion: 100 }],
      });
      saveCustomMaterial({
        name: 'Second',
        category: 'custom',
        description: '',
        composition: [{ nuclideId: 'Li-6', proportion: 100 }],
      });
      expect(getCustomMaterials()).toHaveLength(2);
    });
  });

  describe('updateCustomMaterial', () => {
    it('updates an existing custom material', () => {
      const saved = saveCustomMaterial({
        name: 'Original',
        category: 'custom',
        description: 'Original desc',
        composition: [{ nuclideId: 'Li-7', proportion: 100 }],
      });

      const updated = updateCustomMaterial(saved.id, { name: 'Updated' });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated');
      expect(updated!.id).toBe(saved.id);
      expect(updated!.isCustom).toBe(true);
    });

    it('returns null for non-existent ID', () => {
      expect(updateCustomMaterial('nonexistent', { name: 'X' })).toBeNull();
    });
  });

  describe('deleteCustomMaterial', () => {
    it('deletes an existing custom material', () => {
      const saved = saveCustomMaterial({
        name: 'To Delete',
        category: 'custom',
        description: '',
        composition: [{ nuclideId: 'Li-7', proportion: 100 }],
      });

      expect(deleteCustomMaterial(saved.id)).toBe(true);
      expect(getCustomMaterials()).toHaveLength(0);
    });

    it('returns false for non-existent ID', () => {
      expect(deleteCustomMaterial('nonexistent')).toBe(false);
    });
  });

  // ===== Material Retrieval =====

  describe('getAllMaterials', () => {
    it('includes built-in materials', () => {
      const all = getAllMaterials();
      expect(all.length).toBeGreaterThan(0);
    });

    it('includes custom materials', () => {
      const before = getAllMaterials().length;
      saveCustomMaterial({
        name: 'Custom',
        category: 'custom',
        description: '',
        composition: [{ nuclideId: 'Li-7', proportion: 100 }],
      });
      expect(getAllMaterials().length).toBe(before + 1);
    });
  });

  describe('getMaterialsByCategory', () => {
    it('returns only materials of the specified category', () => {
      const alloys = getMaterialsByCategory('alloy');
      alloys.forEach((m) => expect(m.category).toBe('alloy'));
    });

    it('includes custom materials in custom category', () => {
      saveCustomMaterial({
        name: 'Custom',
        category: 'custom',
        description: '',
        composition: [{ nuclideId: 'Li-7', proportion: 100 }],
      });
      const custom = getMaterialsByCategory('custom');
      expect(custom.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getMaterialById', () => {
    it('finds built-in materials', () => {
      const lithium = getMaterialById('natural-lithium');
      expect(lithium).toBeDefined();
      expect(lithium!.name).toContain('Lithium');
    });

    it('finds custom materials', () => {
      const saved = saveCustomMaterial({
        name: 'Findable',
        category: 'custom',
        description: '',
        composition: [{ nuclideId: 'Li-7', proportion: 100 }],
      });
      const found = getMaterialById(saved.id);
      expect(found).toBeDefined();
      expect(found!.name).toBe('Findable');
    });

    it('returns undefined for non-existent ID', () => {
      expect(getMaterialById('nonexistent')).toBeUndefined();
    });
  });

  describe('category getters', () => {
    it('getNaturalAbundanceMaterials returns natural abundance materials', () => {
      const materials = getNaturalAbundanceMaterials();
      expect(materials.length).toBeGreaterThan(0);
      materials.forEach((m) => expect(m.category).toBe('natural-abundance'));
    });

    it('getAlloyMaterials returns alloy materials', () => {
      const materials = getAlloyMaterials();
      expect(materials.length).toBeGreaterThan(0);
      materials.forEach((m) => expect(m.category).toBe('alloy'));
    });

    it('getCompoundMaterials returns compound materials', () => {
      const materials = getCompoundMaterials();
      expect(materials.length).toBeGreaterThan(0);
      materials.forEach((m) => expect(m.category).toBe('compound'));
    });

    it('getLENRExperimentMaterials returns lenr-experiment materials', () => {
      const materials = getLENRExperimentMaterials();
      expect(materials.length).toBeGreaterThan(0);
      materials.forEach((m) => expect(m.category).toBe('lenr-experiment'));
    });
  });

  // ===== Search and Filtering =====

  describe('searchMaterials', () => {
    it('returns all materials for empty query', () => {
      const all = getAllMaterials();
      const searched = searchMaterials('');
      expect(searched.length).toBe(all.length);
    });

    it('finds materials by name', () => {
      const results = searchMaterials('lithium');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((m) => m.name.toLowerCase().includes('lithium'))).toBe(true);
    });

    it('finds materials by nuclide ID', () => {
      const results = searchMaterials('Ni-58');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for non-matching query', () => {
      const results = searchMaterials('xyznonexistent123');
      expect(results).toHaveLength(0);
    });

    it('is case-insensitive', () => {
      const lower = searchMaterials('nickel');
      const upper = searchMaterials('NICKEL');
      expect(lower.length).toBe(upper.length);
    });
  });

  describe('filterMaterials', () => {
    it('filters by categories', () => {
      const results = filterMaterials({ categories: ['alloy'] });
      results.forEach((m) => expect(m.category).toBe('alloy'));
    });

    it('filters by query', () => {
      const results = filterMaterials({ query: 'lithium' });
      expect(results.length).toBeGreaterThan(0);
    });

    it('filters by minimum nuclide count', () => {
      const results = filterMaterials({ minNuclides: 4 });
      results.forEach((m) => expect(m.composition.length).toBeGreaterThanOrEqual(4));
    });

    it('filters by maximum nuclide count', () => {
      const results = filterMaterials({ maxNuclides: 2 });
      results.forEach((m) => expect(m.composition.length).toBeLessThanOrEqual(2));
    });

    it('combines multiple filters', () => {
      const results = filterMaterials({
        categories: ['natural-abundance'],
        minNuclides: 2,
      });
      results.forEach((m) => {
        expect(m.category).toBe('natural-abundance');
        expect(m.composition.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // ===== Conversion Functions =====

  describe('materialToWeightedNuclides', () => {
    it('converts material composition to weighted nuclides', () => {
      const material: Material = {
        id: 'test',
        name: 'Test',
        category: 'custom',
        description: '',
        composition: [
          { nuclideId: 'Li-7', proportion: 75 },
          { nuclideId: 'Li-6', proportion: 25 },
        ],
      };
      const result = materialToWeightedNuclides(material);
      expect(result).toHaveLength(2);
      expect(result[0].nuclideId).toBe('Li-7');
      expect(result[0].proportion).toBe(75);
      expect(result[0].sourceType).toBe('material');
    });
  });

  describe('createMaterialFromWeightedNuclides', () => {
    it('creates a material from weighted nuclides', () => {
      const nuclides: WeightedNuclide[] = [
        { nuclideId: 'Ni-58', proportion: 68, sourceType: 'manual' },
        { nuclideId: 'Ni-60', proportion: 32, sourceType: 'manual' },
      ];
      const result = createMaterialFromWeightedNuclides(nuclides, 'My Mix', 'Test mix');
      expect(result.name).toBe('My Mix');
      expect(result.description).toBe('Test mix');
      expect(result.category).toBe('custom');
      expect(result.composition).toHaveLength(2);
      expect(result.tags).toContain('custom');
    });
  });

  // ===== Statistics =====

  describe('getMaterialsCatalogStats', () => {
    it('returns total count and breakdown by category', () => {
      const stats = getMaterialsCatalogStats();
      expect(stats.totalMaterials).toBeGreaterThan(0);
      expect(stats.byCategory).toHaveProperty('natural-abundance');
      expect(stats.byCategory).toHaveProperty('alloy');
      expect(stats.byCategory).toHaveProperty('compound');
      expect(stats.byCategory).toHaveProperty('lenr-experiment');
      expect(stats.byCategory).toHaveProperty('custom');
      expect(stats.customCount).toBe(0);
    });

    it('includes custom materials in stats', () => {
      saveCustomMaterial({
        name: 'Custom',
        category: 'custom',
        description: '',
        composition: [{ nuclideId: 'Li-7', proportion: 100 }],
      });
      const stats = getMaterialsCatalogStats();
      expect(stats.customCount).toBe(1);
      expect(stats.byCategory['custom']).toBe(1);
    });
  });

  describe('getAllMaterialTags', () => {
    it('returns sorted unique tags', () => {
      const tags = getAllMaterialTags();
      expect(tags.length).toBeGreaterThan(0);
      // Verify sorted
      const sorted = [...tags].sort();
      expect(tags).toEqual(sorted);
      // Verify unique
      expect(new Set(tags).size).toBe(tags.length);
    });
  });
});
