/**
 * Proportion Service
 *
 * Provides functions for working with weighted fuel proportions:
 * - Format conversion (percentage, atomic ratio, mass ratio)
 * - Normalization to 100%
 * - Validation
 * - Natural abundance lookups
 */

import type { Database } from 'sql.js';
import type { WeightedNuclide, ProportionFormat, AbundanceSource } from '../types';
import { getNuclidesForElement, parseNuclideNotation } from './isotopeService';
import { getNuclideBySymbol } from './queryService';
import { getIAEAAbundancesForElement } from '../constants/iaeaAbundances';

/**
 * Proportion input as entered by user (before normalization)
 */
export interface ProportionInput {
  nuclideId: string;  // e.g., "Li-7", "Ni-58"
  value: number;      // Raw value in current format
}

/**
 * Validation error for proportion inputs
 */
export interface ProportionValidationError {
  nuclideId?: string;  // Which nuclide has the error (undefined = general error)
  message: string;
}

/**
 * Result of validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ProportionValidationError[];
}

/**
 * Validate proportion inputs
 */
export function validateProportions(
  inputs: ProportionInput[],
  format: ProportionFormat
): ValidationResult {
  const errors: ProportionValidationError[] = [];

  // Check for empty inputs
  if (inputs.length === 0) {
    errors.push({ message: 'At least one nuclide proportion is required' });
    return { isValid: false, errors };
  }

  // Validate each input
  for (const input of inputs) {
    // Check nuclide ID format
    const parsed = parseNuclideNotation(input.nuclideId);
    if (!parsed) {
      errors.push({
        nuclideId: input.nuclideId,
        message: `Invalid nuclide notation: ${input.nuclideId}`,
      });
      continue;
    }

    // Check value based on format
    if (typeof input.value !== 'number' || isNaN(input.value)) {
      errors.push({
        nuclideId: input.nuclideId,
        message: 'Value must be a number',
      });
      continue;
    }

    if (input.value < 0) {
      errors.push({
        nuclideId: input.nuclideId,
        message: 'Value cannot be negative',
      });
    }

    // Format-specific validation
    if (format === 'percentage' && input.value > 100) {
      errors.push({
        nuclideId: input.nuclideId,
        message: 'Percentage cannot exceed 100%',
      });
    }
  }

  // Check for duplicate nuclides
  const nuclideIds = inputs.map((i) => i.nuclideId);
  const duplicates = nuclideIds.filter((id, idx) => nuclideIds.indexOf(id) !== idx);
  if (duplicates.length > 0) {
    errors.push({
      message: `Duplicate nuclides: ${[...new Set(duplicates)].join(', ')}`,
    });
  }

  // Check for zero total (all zeros is invalid)
  const total = inputs.reduce((sum, i) => sum + (i.value || 0), 0);
  if (total === 0) {
    errors.push({ message: 'Total proportion cannot be zero' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize proportions to sum to 100%
 */
export function normalizeProportions(
  inputs: ProportionInput[],
  sourceType: WeightedNuclide['sourceType'] = 'manual'
): WeightedNuclide[] {
  const total = inputs.reduce((sum, i) => sum + (i.value || 0), 0);

  if (total === 0) {
    // If all zeros, distribute equally
    const equalProportion = 100 / inputs.length;
    return inputs.map((input) => ({
      nuclideId: input.nuclideId,
      proportion: equalProportion,
      sourceType,
    }));
  }

  // Normalize to 100%
  return inputs.map((input) => ({
    nuclideId: input.nuclideId,
    proportion: (input.value / total) * 100,
    sourceType,
  }));
}

/**
 * Convert atomic ratios to percentages
 * Example: [{ nuclideId: 'Li-7', value: 3 }, { nuclideId: 'Li-6', value: 1 }]
 * Returns: [{ nuclideId: 'Li-7', proportion: 75 }, { nuclideId: 'Li-6', proportion: 25 }]
 */
export function atomicRatioToPercentage(
  inputs: ProportionInput[],
  sourceType: WeightedNuclide['sourceType'] = 'manual'
): WeightedNuclide[] {
  // Atomic ratios are just a special case of normalization
  return normalizeProportions(inputs, sourceType);
}

/**
 * Convert mass ratios to percentages using atomic mass units (AMU)
 * Example: 7g Li-7 + 2g Li-6 → converts to moles, then to atomic ratio
 */
export function massRatioToPercentage(
  db: Database,
  inputs: ProportionInput[],
  sourceType: WeightedNuclide['sourceType'] = 'manual'
): WeightedNuclide[] {
  // Convert mass to moles for each nuclide
  const molesInputs: ProportionInput[] = inputs.map((input) => {
    const parsed = parseNuclideNotation(input.nuclideId);
    if (!parsed) {
      // Fall back to using value as-is if we can't parse
      return input;
    }

    // Get the nuclide to find its AMU
    const nuclide = getNuclideBySymbol(db, parsed.element, parsed.massNumber);
    if (!nuclide || !nuclide.AMU) {
      // Fall back to using mass number as approximate AMU
      return {
        nuclideId: input.nuclideId,
        value: input.value / parsed.massNumber,
      };
    }

    // moles = mass / AMU
    return {
      nuclideId: input.nuclideId,
      value: input.value / nuclide.AMU,
    };
  });

  // Now normalize the moles to percentages
  return normalizeProportions(molesInputs, sourceType);
}

/**
 * Convert between proportion formats
 */
export function convertFormat(
  inputs: ProportionInput[],
  fromFormat: ProportionFormat,
  toFormat: ProportionFormat,
  db?: Database
): WeightedNuclide[] {
  // If converting to the same format, just normalize
  if (fromFormat === toFormat || toFormat === 'percentage') {
    switch (fromFormat) {
      case 'percentage':
        return normalizeProportions(inputs);
      case 'atomic-ratio':
        return atomicRatioToPercentage(inputs);
      case 'mass-ratio':
        if (!db) {
          throw new Error('Database required for mass ratio conversion');
        }
        return massRatioToPercentage(db, inputs);
    }
  }

  // For other conversions, first convert to percentage, then convert to target format
  // But since we only store as percentage internally, we just need to convert to percentage
  return convertFormat(inputs, fromFormat, 'percentage', db);
}

/**
 * Get natural isotopic abundances for an element
 * Returns WeightedNuclide array with proportions from the selected abundance source.
 *
 * @param db - sql.js database instance
 * @param elementSymbol - Element symbol (e.g., 'H', 'Li', 'Ni')
 * @param source - Abundance data source: 'parkhomov' (default) or 'iaea'
 */
export function getNaturalAbundances(
  db: Database,
  elementSymbol: string,
  source: AbundanceSource = 'parkhomov'
): WeightedNuclide[] {
  if (source === 'iaea') {
    return getIAEANaturalAbundances(db, elementSymbol);
  }

  const nuclides = getNuclidesForElement(db, elementSymbol);

  // Filter to only nuclides with abundance data
  const withAbundance = nuclides.filter(
    (n) => n.abundance !== undefined && n.abundance > 0
  );

  if (withAbundance.length === 0) {
    // No abundance data - return all nuclides with equal weight
    return nuclides.map((n) => ({
      nuclideId: n.notation,
      proportion: 100 / nuclides.length,
      sourceType: 'natural' as const,
    }));
  }

  // Use pcaNCrust as proportion directly (it's already in percentage)
  return withAbundance.map((n) => ({
    nuclideId: n.notation,
    proportion: n.abundance!,
    sourceType: 'natural' as const,
  }));
}

/**
 * Get natural isotopic abundances from IAEA data.
 * Falls back to Parkhomov data if IAEA has no data for the element.
 *
 * Safety note: This function only falls back to 'parkhomov' (never to another source),
 * so there is no risk of infinite recursion via getNaturalAbundances.
 */
function getIAEANaturalAbundances(
  db: Database,
  elementSymbol: string
): WeightedNuclide[] {
  const iaeaData = getIAEAAbundancesForElement(elementSymbol);

  if (iaeaData.length === 0) {
    // IAEA has no abundance data for this element; fall back to Parkhomov
    console.warn(
      `IAEA abundance data unavailable for '${elementSymbol}', falling back to Parkhomov source`
    );
    return getNaturalAbundances(db, elementSymbol, 'parkhomov');
  }

  return iaeaData.map((entry) => ({
    nuclideId: `${entry.symbol}-${entry.a}`,
    proportion: entry.abundance,
    sourceType: 'natural' as const,
  }));
}

/**
 * Create equal proportions from nuclide IDs
 */
export function createEqualProportions(
  nuclideIds: string[],
  sourceType: WeightedNuclide['sourceType'] = 'manual'
): WeightedNuclide[] {
  if (nuclideIds.length === 0) return [];

  const equalProportion = 100 / nuclideIds.length;
  return nuclideIds.map((nuclideId) => ({
    nuclideId,
    proportion: equalProportion,
    sourceType,
  }));
}

/**
 * Merge weighted nuclides from multiple elements/materials
 * Re-normalizes after merging
 */
export function mergeWeightedNuclides(
  ...nuclideArrays: WeightedNuclide[][]
): WeightedNuclide[] {
  const merged = new Map<string, WeightedNuclide>();

  for (const nuclides of nuclideArrays) {
    for (const nuclide of nuclides) {
      if (merged.has(nuclide.nuclideId)) {
        // Add proportions together
        const existing = merged.get(nuclide.nuclideId)!;
        merged.set(nuclide.nuclideId, {
          ...existing,
          proportion: existing.proportion + nuclide.proportion,
        });
      } else {
        merged.set(nuclide.nuclideId, { ...nuclide });
      }
    }
  }

  // Convert to array and re-normalize
  const mergedArray = Array.from(merged.values());
  const total = mergedArray.reduce((sum, n) => sum + n.proportion, 0);

  if (total === 0) return mergedArray;

  return mergedArray.map((n) => ({
    ...n,
    proportion: (n.proportion / total) * 100,
  }));
}

/**
 * Format a proportion for display
 * Uses consistent decimal precision without scientific notation
 */
export function formatProportion(proportion: number): string {
  if (proportion >= 10) {
    return `${proportion.toFixed(1)}%`;
  } else if (proportion >= 1) {
    return `${proportion.toFixed(2)}%`;
  } else if (proportion >= 0.01) {
    return `${proportion.toFixed(3)}%`;
  } else if (proportion >= 0.001) {
    return `${proportion.toFixed(4)}%`;
  } else if (proportion > 0) {
    // For very small values, show enough precision to see the value
    return `${proportion.toFixed(5)}%`;
  } else {
    return '0%';
  }
}

/**
 * Get display label for proportion format
 */
export function getFormatLabel(format: ProportionFormat): string {
  switch (format) {
    case 'percentage':
      return 'Percentage (%)';
    case 'atomic-ratio':
      return 'Atomic Ratio';
    case 'mass-ratio':
      return 'Mass Ratio (g)';
  }
}

/**
 * Get help text for proportion format
 */
export function getFormatHelpText(format: ProportionFormat): string {
  switch (format) {
    case 'percentage':
      return 'Enter percentages (0-100). Values will be normalized to 100%.';
    case 'atomic-ratio':
      return 'Enter atomic ratios (e.g., 3:1 becomes 75%:25%).';
    case 'mass-ratio':
      return 'Enter masses in grams. Converted to moles using atomic mass.';
  }
}
