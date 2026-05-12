/**
 * Abundance Comparison Service
 *
 * Compares isotopic abundance data between Parkhomov (pcaNCrust) and IAEA sources.
 * Useful for validating data quality and understanding differences.
 */

import type { Database } from 'sql.js';
import type { AbundanceSource } from '../types';
import { getNaturalAbundances } from './proportionService';

export interface AbundanceComparison {
  nuclideId: string
  parkhomov: number | null
  iaea: number | null
  delta: number | null
  /** Absolute difference as percentage points */
  absDelta: number | null
}

export interface ElementComparison {
  element: string
  isotopes: AbundanceComparison[]
  /** Maximum absolute delta across all isotopes */
  maxDelta: number
  /** Whether both sources have data */
  hasBothSources: boolean
}

/**
 * Compare abundance data between Parkhomov and IAEA for a given element
 */
export function compareAbundances(
  db: Database,
  elementSymbol: string
): ElementComparison {
  const parkhomov = getNaturalAbundances(db, elementSymbol, 'parkhomov');
  const iaea = getNaturalAbundances(db, elementSymbol, 'iaea');

  // Build lookup maps
  const parkhomovMap = new Map(parkhomov.map((p) => [p.nuclideId, p.proportion]));
  const iaeaMap = new Map(iaea.map((i) => [i.nuclideId, i.proportion]));

  // Combine all nuclide IDs
  const allIds = new Set([...parkhomovMap.keys(), ...iaeaMap.keys()]);

  const isotopes: AbundanceComparison[] = [];
  let maxDelta = 0;

  for (const id of allIds) {
    const p = parkhomovMap.get(id) ?? null;
    const i = iaeaMap.get(id) ?? null;
    const delta = p !== null && i !== null ? i - p : null;
    const absDelta = delta !== null ? Math.abs(delta) : null;

    if (absDelta !== null && absDelta > maxDelta) {
      maxDelta = absDelta;
    }

    isotopes.push({ nuclideId: id, parkhomov: p, iaea: i, delta, absDelta });
  }

  // Sort by mass number
  isotopes.sort((a, b) => {
    const aNum = parseInt(a.nuclideId.split('-')[1], 10) || 0;
    const bNum = parseInt(b.nuclideId.split('-')[1], 10) || 0;
    return aNum - bNum;
  });

  return {
    element: elementSymbol,
    isotopes,
    maxDelta,
    hasBothSources: parkhomov.length > 0 && iaea.length > 0,
  };
}

/**
 * Get a human-readable label for an abundance source
 */
export function getAbundanceSourceLabel(source: AbundanceSource): string {
  switch (source) {
    case 'parkhomov':
      return 'Parkhomov Database';
    case 'iaea':
      return 'IAEA NuBase 2020';
  }
}

/**
 * Get a short description of an abundance source
 */
export function getAbundanceSourceDescription(source: AbundanceSource): string {
  switch (source) {
    case 'parkhomov':
      return 'Original isotopic abundances from the Parkhomov database (older IUPAC evaluation)';
    case 'iaea':
      return 'Current IAEA/CIAAW isotopic abundance data (NuBase 2020 evaluation)';
  }
}
