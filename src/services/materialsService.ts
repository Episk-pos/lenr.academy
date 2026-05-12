/**
 * Materials Service
 *
 * Handles materials catalog operations including:
 * - Loading built-in materials (alloys, compounds, LENR experiments)
 * - Managing custom user-defined materials (localStorage)
 * - Searching and filtering materials
 * - Converting materials to weighted nuclides for cascade input
 *
 * Issue #96: Weighted Fuel Proportions and Materials Catalog
 */

import type { Database } from 'sql.js';
import type { Material, WeightedNuclide, MaterialCategory, AbundanceSource } from '../types';
import {
  ALL_BUILTIN_MATERIALS,
  NATURAL_ABUNDANCES,
  ALLOYS,
  COMPOUNDS,
  LENR_EXPERIMENTS,
  getMaterialById as getBuiltinMaterialById,
} from '../constants/materials';
import { getNaturalAbundances } from './proportionService';

// LocalStorage key for custom materials
const CUSTOM_MATERIALS_KEY = 'lenr-custom-materials';

// ============================================================================
// Custom Materials Management
// ============================================================================

/**
 * Get custom materials from localStorage
 */
export function getCustomMaterials(): Material[] {
  try {
    const stored = localStorage.getItem(CUSTOM_MATERIALS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    console.error('Failed to parse custom materials from localStorage');
    return [];
  }
}

/**
 * Save custom materials to localStorage
 */
function saveCustomMaterials(materials: Material[]): void {
  try {
    localStorage.setItem(CUSTOM_MATERIALS_KEY, JSON.stringify(materials));
  } catch (error) {
    console.error('Failed to save custom materials to localStorage:', error);
  }
}

/**
 * Save a new custom material
 */
export function saveCustomMaterial(material: Omit<Material, 'id' | 'isCustom' | 'createdAt'>): Material {
  const customMaterials = getCustomMaterials();

  const newMaterial: Material = {
    ...material,
    id: `custom-${Date.now()}`,
    category: 'custom',
    isCustom: true,
    createdAt: Date.now(),
  };

  customMaterials.push(newMaterial);
  saveCustomMaterials(customMaterials);

  return newMaterial;
}

/**
 * Update an existing custom material
 */
export function updateCustomMaterial(id: string, updates: Partial<Material>): Material | null {
  const customMaterials = getCustomMaterials();
  const index = customMaterials.findIndex((m) => m.id === id);

  if (index === -1) return null;

  customMaterials[index] = {
    ...customMaterials[index],
    ...updates,
    id, // Preserve original ID
    isCustom: true,
  };

  saveCustomMaterials(customMaterials);
  return customMaterials[index];
}

/**
 * Delete a custom material
 */
export function deleteCustomMaterial(id: string): boolean {
  const customMaterials = getCustomMaterials();
  const index = customMaterials.findIndex((m) => m.id === id);

  if (index === -1) return false;

  customMaterials.splice(index, 1);
  saveCustomMaterials(customMaterials);

  return true;
}

// ============================================================================
// Material Retrieval
// ============================================================================

/**
 * Get all materials (built-in + custom)
 */
export function getAllMaterials(): Material[] {
  return [...ALL_BUILTIN_MATERIALS, ...getCustomMaterials()];
}

/**
 * Get materials by category
 */
export function getMaterialsByCategory(category: MaterialCategory): Material[] {
  const allMaterials = getAllMaterials();
  return allMaterials.filter((m) => m.category === category);
}

/**
 * Get a material by ID (searches both built-in and custom)
 */
export function getMaterialById(id: string): Material | undefined {
  // Check built-in first
  const builtin = getBuiltinMaterialById(id);
  if (builtin) return builtin;

  // Check custom materials
  const customMaterials = getCustomMaterials();
  return customMaterials.find((m) => m.id === id);
}

/**
 * Get natural abundance materials
 */
export function getNaturalAbundanceMaterials(): Material[] {
  return [...NATURAL_ABUNDANCES];
}

/**
 * Get alloy materials
 */
export function getAlloyMaterials(): Material[] {
  return [...ALLOYS];
}

/**
 * Get compound materials
 */
export function getCompoundMaterials(): Material[] {
  return [...COMPOUNDS];
}

/**
 * Get LENR experiment materials
 */
export function getLENRExperimentMaterials(): Material[] {
  return [...LENR_EXPERIMENTS];
}

// ============================================================================
// Search and Filtering
// ============================================================================

/**
 * Search materials by query string
 * Searches name, description, and tags
 */
export function searchMaterials(query: string): Material[] {
  if (!query.trim()) return getAllMaterials();

  const normalizedQuery = query.toLowerCase().trim();
  const allMaterials = getAllMaterials();

  return allMaterials.filter((material) => {
    // Search in name
    if (material.name.toLowerCase().includes(normalizedQuery)) return true;

    // Search in description
    if (material.description.toLowerCase().includes(normalizedQuery)) return true;

    // Search in tags
    if (material.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))) return true;

    // Search in nuclide IDs
    if (material.composition.some((c) => c.nuclideId.toLowerCase().includes(normalizedQuery))) {
      return true;
    }

    return false;
  });
}

/**
 * Filter materials by multiple criteria
 */
export interface MaterialFilter {
  categories?: MaterialCategory[];
  query?: string;
  tags?: string[];
  minNuclides?: number;
  maxNuclides?: number;
}

export function filterMaterials(filter: MaterialFilter): Material[] {
  let materials = getAllMaterials();

  // Filter by categories
  if (filter.categories && filter.categories.length > 0) {
    materials = materials.filter((m) => filter.categories!.includes(m.category));
  }

  // Filter by query
  if (filter.query && filter.query.trim()) {
    const normalizedQuery = filter.query.toLowerCase().trim();
    materials = materials.filter(
      (m) =>
        m.name.toLowerCase().includes(normalizedQuery) ||
        m.description.toLowerCase().includes(normalizedQuery) ||
        m.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    );
  }

  // Filter by tags
  if (filter.tags && filter.tags.length > 0) {
    materials = materials.filter((m) =>
      filter.tags!.every((tag) => m.tags?.includes(tag))
    );
  }

  // Filter by nuclide count
  if (filter.minNuclides !== undefined) {
    materials = materials.filter((m) => m.composition.length >= filter.minNuclides!);
  }
  if (filter.maxNuclides !== undefined) {
    materials = materials.filter((m) => m.composition.length <= filter.maxNuclides!);
  }

  return materials;
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Convert a material to weighted nuclides for cascade input
 */
export function materialToWeightedNuclides(material: Material): WeightedNuclide[] {
  return material.composition.map((comp) => ({
    nuclideId: comp.nuclideId,
    proportion: comp.proportion,
    sourceType: 'material' as const,
  }));
}

/**
 * Build a natural abundance material dynamically from database
 * Use this for elements not in the predefined list
 */
export function buildNaturalElementMaterial(
  db: Database,
  elementSymbol: string,
  elementName?: string,
  abundanceSource: AbundanceSource = 'parkhomov'
): Material {
  const abundances = getNaturalAbundances(db, elementSymbol, abundanceSource);
  const sourceLabel = abundanceSource === 'iaea'
    ? 'IAEA NuBase 2020'
    : 'Database (pcaNCrust)';

  return {
    id: `natural-${elementSymbol.toLowerCase()}-dynamic`,
    name: `Natural ${elementName || elementSymbol}`,
    category: 'natural-abundance',
    description: `Natural isotopic composition for ${elementName || elementSymbol}`,
    composition: abundances.map((a) => ({
      nuclideId: a.nuclideId,
      proportion: a.proportion,
    })),
    source: sourceLabel,
    tags: [elementSymbol.toLowerCase(), 'natural', 'dynamic'],
  };
}

/**
 * Create a material from current weighted fuel selection
 * (For "Save Current Fuel" functionality)
 */
export function createMaterialFromWeightedNuclides(
  weightedNuclides: WeightedNuclide[],
  name: string,
  description: string
): Omit<Material, 'id' | 'isCustom' | 'createdAt'> {
  return {
    name,
    category: 'custom',
    description,
    composition: weightedNuclides.map((n) => ({
      nuclideId: n.nuclideId,
      proportion: n.proportion,
    })),
    tags: ['custom', 'user-defined'],
  };
}

// ============================================================================
// Material Statistics
// ============================================================================

/**
 * Get statistics about the materials catalog
 */
export function getMaterialsCatalogStats(): {
  totalMaterials: number;
  byCategory: Record<MaterialCategory, number>;
  customCount: number;
} {
  const allMaterials = getAllMaterials();
  const customMaterials = getCustomMaterials();

  const byCategory: Record<MaterialCategory, number> = {
    'natural-abundance': 0,
    'alloy': 0,
    'compound': 0,
    'lenr-experiment': 0,
    'custom': 0,
  };

  for (const material of allMaterials) {
    byCategory[material.category]++;
  }

  return {
    totalMaterials: allMaterials.length,
    byCategory,
    customCount: customMaterials.length,
  };
}

/**
 * Get all unique tags from materials
 */
export function getAllMaterialTags(): string[] {
  const allMaterials = getAllMaterials();
  const tags = new Set<string>();

  for (const material of allMaterials) {
    if (material.tags) {
      for (const tag of material.tags) {
        tags.add(tag);
      }
    }
  }

  return Array.from(tags).sort();
}
