/**
 * Cascade Feedback Rules
 *
 * Implements filtering and scoring logic for cascade simulations based on:
 * - Temperature thresholds (melting/boiling points)
 * - Boson/Fermion classification
 * - Dimer detection
 * - Element availability constraints
 */

import type { Database } from 'sql.js';
import type { CascadeParameters } from '../types';

/**
 * Element temperature properties cache
 */
interface ElementTempData {
  symbol: string;
  melting: number | null;  // Melting point in Kelvin
  boiling: number | null;  // Boiling point in Kelvin
}

// Cache for element temperature data to avoid repeated queries
const elementTempCache = new Map<string, ElementTempData>();

/**
 * Get melting and boiling point data for elements
 */
export function getElementTemperatureData(
  db: Database,
  elements: string[]
): Map<string, ElementTempData> {
  const result = new Map<string, ElementTempData>();

  // Check cache first
  const uncachedElements: string[] = [];
  for (const element of elements) {
    if (elementTempCache.has(element)) {
      result.set(element, elementTempCache.get(element)!);
    } else {
      uncachedElements.push(element);
    }
  }

  // Query database for uncached elements
  if (uncachedElements.length > 0) {
    const elementsStr = uncachedElements.map(e => `'${e}'`).join(',');
    const query = `
      SELECT E, Melting, Boiling
      FROM ElementPropertiesPlus
      WHERE E IN (${elementsStr})
    `;

    const queryResults = db.exec(query);
    if (queryResults.length > 0) {
      for (const row of queryResults[0].values) {
        const data: ElementTempData = {
          symbol: row[0] as string,
          melting: row[1] as number | null,
          boiling: row[2] as number | null,
        };
        elementTempCache.set(data.symbol, data);
        result.set(data.symbol, data);
      }
    }
  }

  return result;
}

/**
 * Check if a nuclide should be excluded based on temperature constraints
 *
 * - excludeMelted: Remove elements with melting point < temperature
 * - excludeBoiledOff: Remove elements with boiling point < temperature
 */
export function shouldExcludeByTemperature(
  element: string,
  tempData: ElementTempData | undefined,
  params: CascadeParameters
): boolean {
  if (!tempData) return false;

  // Exclude if melting point is above temperature (not yet melted)
  if (params.excludeMelted && tempData.melting !== null) {
    if (params.temperature < tempData.melting) {
      return true;
    }
  }

  // Exclude if boiling point is below temperature (boiled off)
  if (params.excludeBoiledOff && tempData.boiling !== null) {
    if (params.temperature > tempData.boiling) {
      return true;
    }
  }

  return false;
}

/**
 * Get boson/fermion classification for a nuclide
 *
 * Query NuclidesPlus table for nBorF and aBorF
 */
export interface BosonFermionData {
  nuclideId: string;
  nBorF: 'b' | 'f';  // Nuclear: based on mass number A
  aBorF: 'b' | 'f';  // Atomic: based on neutron count (A-Z)
}

export function getBosonFermionData(
  db: Database,
  nuclideIds: string[]
): Map<string, BosonFermionData> {
  const result = new Map<string, BosonFermionData>();

  if (nuclideIds.length === 0) return result;

  // Build WHERE clause for nuclides
  const conditions: string[] = [];
  for (const nuclideId of nuclideIds) {
    const parts = nuclideId.split('-');
    const element = parts[0];
    const mass = parseInt(parts[1]);
    conditions.push(`(E = '${element}' AND A = ${mass})`);
  }

  const query = `
    SELECT E, A, nBorF, aBorF
    FROM NuclidesPlus
    WHERE ${conditions.join(' OR ')}
  `;

  const queryResults = db.exec(query);
  if (queryResults.length > 0) {
    for (const row of queryResults[0].values) {
      const nuclideId = `${row[0]}-${row[1]}`;
      result.set(nuclideId, {
        nuclideId,
        nBorF: row[2] as 'b' | 'f',
        aBorF: row[3] as 'b' | 'f',
      });
    }
  }

  return result;
}

/**
 * Check if a nuclide should be excluded based on boson/fermion feedback rules
 */
export function shouldExcludeByBosonFermion(
  nuclideId: string,
  bfData: BosonFermionData | undefined,
  params: CascadeParameters
): boolean {
  if (!bfData) return false;

  // If feedbackBosons is disabled, exclude bosons
  if (!params.feedbackBosons && bfData.nBorF === 'b') {
    return true;
  }

  // If feedbackFermions is disabled, exclude fermions
  if (!params.feedbackFermions && bfData.nBorF === 'f') {
    return true;
  }

  return false;
}

/**
 * Check if a reaction involves two identical nuclides (dimer formation)
 */
export function isDimerReaction(input1: string, input2: string): boolean {
  return input1 === input2;
}

/**
 * Dimer elements that can form homonuclear molecules
 * H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂
 */
const DIMER_ELEMENTS = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I']);

/**
 * Check if a nuclide element can form dimers
 */
export function canFormDimer(nuclideId: string): boolean {
  const element = nuclideId.split('-')[0];
  return DIMER_ELEMENTS.has(element);
}

/**
 * Apply all feedback rules to filter new products
 *
 * Returns filtered set of nuclide IDs that pass all rules
 */
export function applyFeedbackRules(
  db: Database,
  nuclideIds: string[],
  params: CascadeParameters
): string[] {
  if (nuclideIds.length === 0) return [];

  // Get element symbols
  const elements = new Set<string>();
  for (const nuclideId of nuclideIds) {
    elements.add(nuclideId.split('-')[0]);
  }

  // Get temperature data if needed
  let tempDataMap: Map<string, ElementTempData> | null = null;
  if (params.excludeMelted || params.excludeBoiledOff) {
    tempDataMap = getElementTemperatureData(db, Array.from(elements));
  }

  // Get boson/fermion data if needed
  let bfDataMap: Map<string, BosonFermionData> | null = null;
  if (!params.feedbackBosons || !params.feedbackFermions) {
    bfDataMap = getBosonFermionData(db, nuclideIds);
  }

  // Filter nuclides
  const filtered: string[] = [];
  for (const nuclideId of nuclideIds) {
    const element = nuclideId.split('-')[0];

    // Temperature filtering
    if (tempDataMap) {
      const tempData = tempDataMap.get(element);
      if (shouldExcludeByTemperature(element, tempData, params)) {
        continue;
      }
    }

    // Boson/Fermion filtering
    if (bfDataMap) {
      const bfData = bfDataMap.get(nuclideId);
      if (shouldExcludeByBosonFermion(nuclideId, bfData, params)) {
        continue;
      }
    }

    filtered.push(nuclideId);
  }

  return filtered;
}

/**
 * Check if a dimer reaction should be allowed
 */
export function shouldAllowDimerReaction(
  input1: string,
  input2: string,
  params: CascadeParameters
): boolean {
  if (!isDimerReaction(input1, input2)) {
    return true;  // Not a dimer, always allow
  }

  // If dimers are disabled, block dimer reactions
  if (!params.allowDimers) {
    // Only block if the element can actually form dimers
    if (canFormDimer(input1)) {
      return false;
    }
  }

  return true;
}
