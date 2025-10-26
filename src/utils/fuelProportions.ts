import type { FuelNuclide, ProportionFormat } from '../types';

/**
 * Utility functions for handling weighted fuel nuclide proportions
 * in cascade simulations.
 */

/**
 * Parse and normalize fuel nuclides with proportions
 * 
 * Supports multiple input formats:
 * - Percentage: Li-7: 92.5%, Li-6: 7.5%
 * - Atomic ratio: Li-7: 92.5, Li-6: 7.5
 * - Mass ratio: converts using atomic masses
 * 
 * @param fuelInput - Array of nuclides (simple strings or FuelNuclide objects)
 * @param format - Proportion format (default: 'percentage')
 * @returns Normalized FuelNuclide array with proportions summing to 1.0
 */
export function normalizeFuelProportions(
  fuelInput: string[] | FuelNuclide[],
  format: ProportionFormat = 'percentage'
): FuelNuclide[] {
  // Handle simple string array (backward compatibility)
  if (fuelInput.length === 0) {
    return [];
  }

  if (typeof fuelInput[0] === 'string') {
    // Equal proportions for unweighted mode
    const proportion = 1.0 / fuelInput.length;
    return (fuelInput as string[]).map(nuclideId => ({
      nuclideId,
      proportion,
      displayValue: 100 / fuelInput.length,
      format: 'percentage',
    }));
  }

  // Handle FuelNuclide array
  const fuelNuclides = fuelInput as FuelNuclide[];

  // Calculate sum for normalization
  let sum = 0;
  for (const fuel of fuelNuclides) {
    if (fuel.proportion < 0) {
      throw new Error(`Negative proportion not allowed: ${fuel.nuclideId} = ${fuel.proportion}`);
    }
    sum += fuel.proportion;
  }

  if (sum === 0) {
    throw new Error('Sum of proportions cannot be zero');
  }

  // Normalize proportions to sum to 1.0
  return fuelNuclides.map(fuel => ({
    ...fuel,
    proportion: fuel.proportion / sum,
    format: format,
  }));
}

/**
 * Convert proportions from one format to another
 * 
 * @param fuelNuclides - Array of fuel nuclides
 * @param targetFormat - Target format
 * @param atomicMasses - Map of nuclide ID to atomic mass (required for mass_ratio)
 * @returns Converted FuelNuclide array
 */
export function convertProportionFormat(
  fuelNuclides: FuelNuclide[],
  targetFormat: ProportionFormat,
  atomicMasses?: Map<string, number>
): FuelNuclide[] {
  if (targetFormat === 'percentage') {
    return fuelNuclides.map(fuel => ({
      ...fuel,
      displayValue: fuel.proportion * 100,
      format: 'percentage',
    }));
  }

  if (targetFormat === 'atomic_ratio') {
    // Find smallest proportion to use as base
    const minProportion = Math.min(...fuelNuclides.map(f => f.proportion));
    return fuelNuclides.map(fuel => ({
      ...fuel,
      displayValue: fuel.proportion / minProportion,
      format: 'atomic_ratio',
    }));
  }

  if (targetFormat === 'mass_ratio') {
    if (!atomicMasses) {
      throw new Error('Atomic masses required for mass_ratio conversion');
    }

    // Convert atomic proportions to mass proportions
    const massProportions = fuelNuclides.map(fuel => {
      const mass = atomicMasses.get(fuel.nuclideId) || 0;
      return fuel.proportion * mass;
    });

    const minMass = Math.min(...massProportions);
    return fuelNuclides.map((fuel, index) => ({
      ...fuel,
      displayValue: massProportions[index] / minMass,
      format: 'mass_ratio',
    }));
  }

  return fuelNuclides;
}

/**
 * Parse fuel proportions from mass ratios
 * 
 * @param massRatios - Map of nuclide ID to mass value
 * @param atomicMasses - Map of nuclide ID to atomic mass
 * @returns Normalized FuelNuclide array
 */
export function parseMassRatios(
  massRatios: Map<string, number>,
  atomicMasses: Map<string, number>
): FuelNuclide[] {
  const fuelNuclides: FuelNuclide[] = [];

  for (const [nuclideId, massValue] of massRatios.entries()) {
    const atomicMass = atomicMasses.get(nuclideId);
    if (!atomicMass) {
      throw new Error(`Atomic mass not found for nuclide: ${nuclideId}`);
    }

    // Convert mass to molar proportion
    const molarProportion = massValue / atomicMass;

    fuelNuclides.push({
      nuclideId,
      proportion: molarProportion,
      displayValue: massValue,
      format: 'mass_ratio',
    });
  }

  return normalizeFuelProportions(fuelNuclides, 'mass_ratio');
}

/**
 * Validate fuel proportions
 * 
 * @param fuelNuclides - Array of fuel nuclides
 * @returns Validation result with errors if any
 */
export function validateFuelProportions(fuelNuclides: FuelNuclide[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (fuelNuclides.length === 0) {
    errors.push('At least one fuel nuclide is required');
    return { isValid: false, errors };
  }

  // Check for negative proportions
  for (const fuel of fuelNuclides) {
    if (fuel.proportion < 0) {
      errors.push(`Negative proportion not allowed: ${fuel.nuclideId} = ${fuel.proportion}`);
    }
  }

  // Check sum
  const sum = fuelNuclides.reduce((acc, fuel) => acc + fuel.proportion, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    errors.push(`Proportions must sum to 1.0 (current sum: ${sum.toFixed(3)})`);
  }

  // Check for duplicate nuclides
  const nuclideIds = new Set<string>();
  for (const fuel of fuelNuclides) {
    if (nuclideIds.has(fuel.nuclideId)) {
      errors.push(`Duplicate nuclide: ${fuel.nuclideId}`);
    }
    nuclideIds.add(fuel.nuclideId);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get atomic mass from nuclide ID
 * Extracts mass number from format like "Li-7" → 7
 * 
 * @param nuclideId - Nuclide ID (e.g., "Li-7")
 * @returns Atomic mass number
 */
export function getAtomicMassFromId(nuclideId: string): number {
  const parts = nuclideId.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid nuclide ID format: ${nuclideId}`);
  }
  return parseInt(parts[1], 10);
}

/**
 * Calculate reaction weight from input nuclide proportions
 * 
 * For a reaction A + B → products:
 * - Weight = proportion(A) × proportion(B)
 * 
 * This reflects the probability that both reactants are available
 * to participate in the reaction.
 * 
 * @param input1 - First input nuclide ID
 * @param input2 - Second input nuclide ID
 * @param proportions - Map of nuclide ID to proportion
 * @returns Reaction weight (0.0 to 1.0)
 */
export function calculateReactionWeight(
  input1: string,
  input2: string,
  proportions: Map<string, number>
): number {
  const prop1 = proportions.get(input1) || 0;
  const prop2 = proportions.get(input2) || 0;

  // Multiplicative probability for independent events
  return prop1 * prop2;
}

/**
 * Create a default fuel nuclide array from simple strings
 * (Backward compatibility helper)
 * 
 * @param nuclideIds - Array of nuclide IDs
 * @returns FuelNuclide array with equal proportions
 */
export function createEqualProportionFuel(nuclideIds: string[]): FuelNuclide[] {
  if (nuclideIds.length === 0) {
    return [];
  }

  const proportion = 1.0 / nuclideIds.length;
  const displayValue = 100 / nuclideIds.length;

  return nuclideIds.map(nuclideId => ({
    nuclideId,
    proportion,
    displayValue,
    format: 'percentage' as ProportionFormat,
  }));
}

/**
 * Format proportion for display
 * 
 * @param fuel - Fuel nuclide
 * @returns Formatted string (e.g., "92.5%", "3:1", "7.0g")
 */
export function formatProportion(fuel: FuelNuclide): string {
  const value = fuel.displayValue ?? fuel.proportion * 100;

  switch (fuel.format) {
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'atomic_ratio':
      return value.toFixed(2);
    case 'mass_ratio':
      return `${value.toFixed(2)}g`;
    default:
      return `${(fuel.proportion * 100).toFixed(2)}%`;
  }
}

