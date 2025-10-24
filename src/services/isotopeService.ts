/**
 * Isotope Selection Service
 *
 * Provides helper functions for working with nuclide/isotope selection,
 * including natural abundance data and filtering capabilities.
 */

import type { Database } from 'sql.js';
import type { Nuclide } from '../types';

export type AbundanceTier = 'abundant' | 'trace' | 'rare' | 'synthetic';

export interface NuclideWithAbundance extends Nuclide {
  abundance?: number;        // % abundance in Earth's crust
  abundanceTier: AbundanceTier;
  isStable: boolean;
  notation: string;          // Standard notation (e.g., "Li-7", "Ni-58")
}

/**
 * Get all nuclides for a given element with abundance data
 */
export function getNuclidesForElement(
  db: Database,
  elementSymbol: string
): NuclideWithAbundance[] {
  const sql = 'SELECT * FROM NuclidesPlus WHERE E = ? ORDER BY A';
  const results = db.exec(sql, [elementSymbol]);

  if (results.length === 0 || results[0].values.length === 0) {
    return [];
  }

  const columns = results[0].columns;
  const nuclides: NuclideWithAbundance[] = [];

  results[0].values.forEach((row) => {
    const nuclide: any = {};

    // Map database columns to TypeScript interface
    columns.forEach((col, idx) => {
      const value = row[idx];

      // Map database column names to interface properties
      if (col === 'P') nuclide.Period = value;
      else if (col === 'G') nuclide.Group = value;
      else if (col === 'LHL') nuclide.logHalfLife = value;
      else nuclide[col] = value;
    });

    // Calculate abundance percentage from database
    const abundance = nuclide.pcaNCrust !== null && nuclide.pcaNCrust !== undefined
      ? nuclide.pcaNCrust
      : null;

    // Determine stability (log half-life > 9 means > 1 billion years)
    const isStable = nuclide.logHalfLife !== null && nuclide.logHalfLife !== undefined
      ? nuclide.logHalfLife > 9
      : false;

    // Create standard notation
    const notation = `${nuclide.E}-${nuclide.A}`;

    // Determine abundance tier
    let abundanceTier: AbundanceTier;
    if (abundance === null || abundance === undefined) {
      abundanceTier = 'synthetic';
    } else if (abundance >= 10) {
      abundanceTier = 'abundant';
    } else if (abundance >= 0.1) {
      abundanceTier = 'trace';
    } else {
      abundanceTier = 'rare';
    }

    nuclides.push({
      ...nuclide,
      abundance: abundance ?? undefined,
      abundanceTier,
      isStable,
      notation,
    } as NuclideWithAbundance);
  });

  // Sort by abundance (most abundant first), then by mass number
  nuclides.sort((a, b) => {
    const abundanceA = a.abundance ?? -1;
    const abundanceB = b.abundance ?? -1;

    if (abundanceB !== abundanceA) {
      return abundanceB - abundanceA; // Descending by abundance
    }

    return a.A - b.A; // Ascending by mass number
  });

  return nuclides;
}

/**
 * Get the color class for an abundance tier
 */
export function getAbundanceTierColor(tier: AbundanceTier): string {
  switch (tier) {
    case 'abundant':
      return 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-600 text-green-900 dark:text-green-100';
    case 'trace':
      return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-600 text-yellow-900 dark:text-yellow-100';
    case 'rare':
    case 'synthetic':
      return 'bg-gray-100 dark:bg-gray-800 border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300';
  }
}

/**
 * Get hover color class for abundance tier
 */
export function getAbundanceTierHoverColor(tier: AbundanceTier): string {
  switch (tier) {
    case 'abundant':
      return 'hover:bg-green-200 dark:hover:bg-green-800/50';
    case 'trace':
      return 'hover:bg-yellow-200 dark:hover:bg-yellow-800/50';
    case 'rare':
    case 'synthetic':
      return 'hover:bg-gray-200 dark:hover:bg-gray-700';
  }
}

/**
 * Filter nuclides by minimum abundance threshold
 */
export function filterAbundantNuclides(
  nuclides: NuclideWithAbundance[],
  minAbundance: number = 1.0
): NuclideWithAbundance[] {
  return nuclides.filter((n) => n.abundance !== undefined && n.abundance >= minAbundance);
}

/**
 * Filter to only stable nuclides
 */
export function filterStableNuclides(
  nuclides: NuclideWithAbundance[]
): NuclideWithAbundance[] {
  return nuclides.filter((n) => n.isStable);
}

/**
 * Get the most abundant nuclide for an element
 */
export function getMostAbundantNuclide(
  nuclides: NuclideWithAbundance[]
): NuclideWithAbundance | null {
  if (nuclides.length === 0) return null;

  // Already sorted by abundance in getNuclidesForElement
  const mostAbundant = nuclides.find((n) => n.abundance !== undefined && n.abundance > 0);
  return mostAbundant || nuclides[0];
}

/**
 * Format abundance percentage for display
 */
export function formatAbundance(abundance: number | undefined): string {
  if (abundance === undefined || abundance === null) {
    return 'Synthetic';
  }

  if (abundance >= 10) {
    return `${abundance.toFixed(1)}%`;
  } else if (abundance >= 0.1) {
    return `${abundance.toFixed(2)}%`;
  } else if (abundance > 0) {
    return `${abundance.toFixed(3)}%`;
  } else {
    return '<0.001%';
  }
}

/**
 * Parse nuclide notation (e.g., "Li-7", "Li7", "D", "T") to standard format
 */
export function parseNuclideNotation(notation: string): { element: string; massNumber: number } | null {
  const trimmed = notation.trim();

  // Special cases for hydrogen isotopes
  if (trimmed === 'D') return { element: 'D', massNumber: 2 };
  if (trimmed === 'T') return { element: 'T', massNumber: 3 };

  // Match patterns like "Li-7", "Li7", "U-235", "U235"
  const match = trimmed.match(/^([A-Z][a-z]?)[-\s]?(\d+)$/);

  if (match) {
    return {
      element: match[1],
      massNumber: parseInt(match[2], 10),
    };
  }

  return null;
}

/**
 * Format nuclide to standard notation (e.g., "Li-7")
 */
export function formatNuclideNotation(element: string, massNumber: number): string {
  // Keep special hydrogen isotope notation
  if (element === 'D' && massNumber === 2) return 'D';
  if (element === 'T' && massNumber === 3) return 'T';

  return `${element}-${massNumber}`;
}
