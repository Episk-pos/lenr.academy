/**
 * Cascade Simulation Web Worker
 *
 * Runs cascade simulations in a background thread to keep the UI responsive.
 * Sends progress updates during execution and supports cancellation.
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type { CascadeParameters, CascadeResults } from '../types';
import { applyFeedbackRules, shouldAllowDimerReaction } from '../services/cascadeFeedbackRules';

// Message types
export interface CascadeWorkerRequest {
  type: 'run';
  params: CascadeParameters;
  dbBuffer: ArrayBuffer;
}

export interface CascadeProgressMessage {
  type: 'progress';
  loop: number;
  totalLoops: number;
  newReactionsCount: number;
  newReactions?: any[];  // Incremental reactions for real-time visualization
}

export interface CascadeCompleteMessage {
  type: 'complete';
  results: CascadeResults;
}

export interface CascadeErrorMessage {
  type: 'error';
  error: string;
}

export type CascadeWorkerResponse =
  | CascadeProgressMessage
  | CascadeCompleteMessage
  | CascadeErrorMessage;

let db: SqlJsDatabase | null = null;
let isRunning = false;
let shouldCancel = false;

/**
 * Initialize the database from an ArrayBuffer
 */
async function initDatabase(buffer: ArrayBuffer): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });

  const uint8Array = new Uint8Array(buffer);
  db = new SQL.Database(uint8Array);
}

/**
 * Parse fuel nuclide strings into standardized format
 */
function parseFuelNuclides(fuelNuclides: string[]): string[] {
  const parsed: string[] = [];

  for (const nuclide of fuelNuclides) {
    const trimmed = nuclide.trim();
    if (!trimmed) continue;

    // Special hydrogen isotope handling
    if (trimmed === 'D') {
      parsed.push('D-2');
      continue;
    }
    if (trimmed === 'T') {
      parsed.push('T-3');
      continue;
    }

    // Match patterns: "H-1", "H1", "Li-7", "Li7"
    const match = trimmed.match(/^([A-Z][a-z]?)[-\s]?(\d+)$/);
    if (!match) {
      throw new Error(`Invalid nuclide format: "${nuclide}"`);
    }

    const [, element, mass] = match;
    parsed.push(`${element}-${mass}`);
  }

  return parsed;
}

/**
 * Build nuclide ID from element symbol and mass number
 */
function buildNuclideId(E: string, A: number): string {
  return `${E}-${A}`;
}

/**
 * Run cascade simulation with progress updates
 */
async function runCascadeWithProgress(params: CascadeParameters): Promise<CascadeResults> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  const startTime = performance.now();

  // Parse fuel nuclides
  const fuelNuclideIds = parseFuelNuclides(params.fuelNuclides);
  if (fuelNuclideIds.length === 0) {
    throw new Error('No valid fuel nuclides provided');
  }

  const allReactions: any[] = [];
  const productDistribution = new Map<string, number>();
  const activeNuclides = new Set<string>(fuelNuclideIds);
  const processedNuclides = new Set<string>();

  let loopCount = 0;
  let terminationReason: 'max_loops' | 'no_new_products' | 'max_nuclides' = 'no_new_products';

  // Main cascade loop
  while (loopCount < params.maxLoops && !shouldCancel) {
    const newProducts = new Set<string>();
    const currentNuclides = Array.from(activeNuclides);

    // Check max nuclides limit
    if (currentNuclides.length > params.maxNuclides) {
      terminationReason = 'max_nuclides';
      break;
    }

    // Extract element symbols
    const elementSet = new Set<string>();
    for (const nuclideId of currentNuclides) {
      const parts = nuclideId.split('-');
      elementSet.add(parts[0]);
    }
    const elements = Array.from(elementSet);
    const elementsStr = elements.map(e => `'${e}'`).join(',');

    let newReactionsThisLoop = 0;
    const reactionsThisLoop: any[] = [];  // Track reactions for this loop

    // Query fusion reactions
    const fusionQuery = `
      SELECT E1, Z1, A1, E2, Z2, A2, E, Z, A, MeV, neutrino
      FROM FusionAll
      WHERE E1 IN (${elementsStr})
        AND E2 IN (${elementsStr})
        AND MeV >= ${params.minFusionMeV}
        AND CAST(Z1 AS INTEGER) = CAST(Z1 AS INTEGER)
      LIMIT 10000
    `;

    const fusionResults = db.exec(fusionQuery);
    if (fusionResults.length > 0) {
      const rows = fusionResults[0].values;
      for (const row of rows) {
        const input1 = buildNuclideId(row[0] as string, row[2] as number);
        const input2 = buildNuclideId(row[3] as string, row[5] as number);
        const output = buildNuclideId(row[6] as string, row[8] as number);

        // Check if this reaction should be included
        const shouldInclude = activeNuclides.has(input1) &&
                             activeNuclides.has(input2) &&
                             !activeNuclides.has(output) &&
                             shouldAllowDimerReaction(input1, input2, params);

        if (shouldInclude) {
          const reaction = {
            type: 'fusion',
            inputs: [input1, input2],
            outputs: [output],
            MeV: row[9] as number,
            loop: loopCount,
            neutrino: row[10] as string,
          };
          allReactions.push(reaction);
          reactionsThisLoop.push(reaction);  // Track for incremental update

          newProducts.add(output);
          productDistribution.set(output, (productDistribution.get(output) || 0) + 1);
          newReactionsThisLoop++;
        }
      }
    }

    // Query two-to-two reactions
    const twoToTwoQuery = `
      SELECT E1, Z1, A1, E2, Z2, A2, E3, Z3, A3, E4, Z4, A4, MeV, neutrino
      FROM TwoToTwoAll
      WHERE E1 IN (${elementsStr})
        AND E2 IN (${elementsStr})
        AND MeV >= ${params.minTwoToTwoMeV}
        AND CAST(Z1 AS INTEGER) = CAST(Z1 AS INTEGER)
      LIMIT 10000
    `;

    const twoToTwoResults = db.exec(twoToTwoQuery);
    if (twoToTwoResults.length > 0) {
      const rows = twoToTwoResults[0].values;
      for (const row of rows) {
        const input1 = buildNuclideId(row[0] as string, row[2] as number);
        const input2 = buildNuclideId(row[3] as string, row[5] as number);
        const output1 = buildNuclideId(row[6] as string, row[8] as number);
        const output2 = buildNuclideId(row[9] as string, row[11] as number);

        const hasNewOutput = !activeNuclides.has(output1) || !activeNuclides.has(output2);
        const shouldInclude = activeNuclides.has(input1) &&
                             activeNuclides.has(input2) &&
                             hasNewOutput &&
                             shouldAllowDimerReaction(input1, input2, params);

        if (shouldInclude) {
          const reaction = {
            type: 'twotwo',
            inputs: [input1, input2],
            outputs: [output1, output2],
            MeV: row[12] as number,
            loop: loopCount,
            neutrino: row[13] as string,
          };
          allReactions.push(reaction);
          reactionsThisLoop.push(reaction);  // Track for incremental update

          newProducts.add(output1);
          newProducts.add(output2);
          productDistribution.set(output1, (productDistribution.get(output1) || 0) + 1);
          productDistribution.set(output2, (productDistribution.get(output2) || 0) + 1);
          newReactionsThisLoop++;
        }
      }
    }

    // Send progress update with incremental reactions for real-time visualization
    postMessage({
      type: 'progress',
      loop: loopCount,
      totalLoops: params.maxLoops,
      newReactionsCount: newReactionsThisLoop,
      newReactions: reactionsThisLoop,
    } as CascadeProgressMessage);

    // Apply feedback rules to filter new products
    const newProductsArray = Array.from(newProducts);
    const filteredProducts = applyFeedbackRules(db, newProductsArray, params);

    // Check for new products that pass feedback rules
    const hasNewProducts = filteredProducts.some(p => !processedNuclides.has(p));

    if (!hasNewProducts) {
      terminationReason = 'no_new_products';
      break;
    }

    // Feedback: add filtered products to active pool
    for (const product of filteredProducts) {
      activeNuclides.add(product);
      processedNuclides.add(product);
    }

    loopCount++;
  }

  if (shouldCancel) {
    throw new Error('Cascade simulation cancelled');
  }

  if (loopCount >= params.maxLoops) {
    terminationReason = 'max_loops';
  }

  // Finalization phase - calculate energy with progress updates
  postMessage({
    type: 'progress',
    loop: loopCount,
    totalLoops: params.maxLoops,
    newReactionsCount: -1, // Special value to indicate finalizing
  } as CascadeProgressMessage);

  // Calculate total energy in batches to allow progress updates
  let totalEnergy = 0;
  const batchSize = 1000;
  for (let i = 0; i < allReactions.length; i += batchSize) {
    const batch = allReactions.slice(i, i + batchSize);
    totalEnergy += batch.reduce((sum, r) => sum + r.MeV, 0);

    // Send progress every batch
    if (i + batchSize < allReactions.length) {
      postMessage({
        type: 'progress',
        loop: loopCount,
        totalLoops: params.maxLoops,
        newReactionsCount: -2, // Special value for energy calculation
      } as CascadeProgressMessage);
    }
  }

  const executionTime = performance.now() - startTime;

  // Get unique nuclides and elements (simplified - returning empty arrays for now)
  const nuclides: any[] = [];
  const elements: any[] = [];

  // Final progress before serialization
  postMessage({
    type: 'progress',
    loop: loopCount,
    totalLoops: params.maxLoops,
    newReactionsCount: -3, // Special value for serialization
  } as CascadeProgressMessage);

  return {
    reactions: allReactions,
    productDistribution,
    nuclides,
    elements,
    totalEnergy,
    loopsExecuted: loopCount,
    executionTime,
    terminationReason,
  };
}

/**
 * Message handler
 */
self.onmessage = async (event: MessageEvent<CascadeWorkerRequest | { type: 'cancel' }>) => {
  const message = event.data;

  if (message.type === 'cancel') {
    shouldCancel = true;
    return;
  }

  if (message.type === 'run') {
    try {
      isRunning = true;
      shouldCancel = false;

      // Initialize database if needed
      if (!db) {
        await initDatabase(message.dbBuffer);
      }

      // Run cascade with progress updates
      const results = await runCascadeWithProgress(message.params);

      postMessage({
        type: 'complete',
        results,
      } as CascadeCompleteMessage);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      postMessage({
        type: 'error',
        error: errorMessage,
      } as CascadeErrorMessage);
    } finally {
      isRunning = false;
      shouldCancel = false;
    }
  }
};
