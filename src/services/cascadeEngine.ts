import type { Database } from 'sql.js';
import type {
  CascadeParameters,
  CascadeResults,
  CascadeReaction,
} from '../types';
import { queryFusion, queryTwoToTwo, getAllNuclides, getAllElements } from './queryService';

/**
 * Parse fuel nuclide strings into standardized format
 * Supports formats: "H-1", "H1", "D", "T", "Li-7", "Li7"
 *
 * @param fuelNuclides - Array of nuclide strings
 * @returns Array of standardized nuclide IDs in "E-A" format
 * @throws Error if nuclide format is invalid
 */
export function parseFuelNuclides(fuelNuclides: string[]): string[] {
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
      throw new Error(`Invalid nuclide format: "${nuclide}". Expected format: "E-A" (e.g., "H-1", "Li-7")`);
    }

    const [, element, mass] = match;
    parsed.push(`${element}-${mass}`);
  }

  return parsed;
}

/**
 * Convert nuclide ID (e.g., "H-1") to element symbol and mass number
 */
function parseNuclideId(nuclideId: string): { E: string; A: number } {
  const parts = nuclideId.split('-');
  if (parts.length !== 2) {
    throw new Error(`Invalid nuclide ID: ${nuclideId}`);
  }
  return { E: parts[0], A: parseInt(parts[1], 10) };
}

/**
 * Build nuclide ID from element symbol and mass number
 */
function buildNuclideId(E: string, A: number): string {
  return `${E}-${A}`;
}

/**
 * Run cascade simulation
 *
 * Simulates recursive nuclear transmutation chains starting from fuel nuclides.
 *
 * Algorithm:
 * 1. Parse fuel nuclides and add to active pool
 * 2. For each loop (up to maxLoops):
 *    a. Find all fusion reactions between active nuclides
 *    b. Find all two-to-two reactions between active nuclides
 *    c. Filter by energy thresholds
 *    d. Extract product nuclides
 *    e. Add new products to active pool (feedback)
 *    f. If no new products, terminate
 * 3. Return complete reaction tree and statistics
 *
 * @param db - SQLite database instance
 * @param params - Cascade parameters
 * @returns Cascade simulation results
 */
export async function runCascadeSimulation(
  db: Database,
  params: CascadeParameters
): Promise<CascadeResults> {
  const startTime = performance.now();

  // Parse and validate fuel nuclides
  const fuelNuclideIds = parseFuelNuclides(params.fuelNuclides);
  if (fuelNuclideIds.length === 0) {
    throw new Error('No valid fuel nuclides provided');
  }

  // Track all reactions and nuclides
  const allReactions: CascadeReaction[] = [];
  const productDistribution = new Map<string, number>();
  const activeNuclides = new Set<string>(fuelNuclideIds);
  const processedNuclides = new Set<string>();

  let loopCount = 0;
  let terminationReason: 'max_loops' | 'no_new_products' | 'max_nuclides' = 'no_new_products';

  // Main cascade loop
  while (loopCount < params.maxLoops) {
    const newProducts = new Set<string>();

    // Get current active nuclide list
    const currentNuclides = Array.from(activeNuclides);

    // Check max nuclides limit
    if (currentNuclides.length > params.maxNuclides) {
      terminationReason = 'max_nuclides';
      break;
    }

    // Extract element symbols for querying
    const elementSet = new Set<string>();
    for (const nuclideId of currentNuclides) {
      const { E } = parseNuclideId(nuclideId);
      elementSet.add(E);
    }
    const elements = Array.from(elementSet);

    // Query fusion reactions (A + B → C)
    const fusionResult = await queryFusion(db, {
      element1List: elements,
      element2List: elements,
      minMeV: params.minFusionMeV,
    });

    // Process fusion reactions
    for (const reaction of fusionResult.reactions) {
      const input1 = buildNuclideId(reaction.E1, reaction.A1);
      const input2 = buildNuclideId(reaction.E2, reaction.A2);
      const output = buildNuclideId(reaction.E, reaction.A);

      // Only include if both inputs are in active pool AND output is new
      if (activeNuclides.has(input1) && activeNuclides.has(input2) && !activeNuclides.has(output)) {
        allReactions.push({
          type: 'fusion',
          inputs: [input1, input2],
          outputs: [output],
          MeV: reaction.MeV,
          loop: loopCount,
          neutrino: reaction.neutrino,
        });

        // Track product
        newProducts.add(output);
        productDistribution.set(output, (productDistribution.get(output) || 0) + 1);
      }
    }

    // Query two-to-two reactions (A + B → C + D)
    const twoToTwoResult = await queryTwoToTwo(db, {
      element1List: elements,
      element2List: elements,
      minMeV: params.minTwoToTwoMeV,
    });

    // Process two-to-two reactions
    for (const reaction of twoToTwoResult.reactions) {
      const input1 = buildNuclideId(reaction.E1, reaction.A1);
      const input2 = buildNuclideId(reaction.E2, reaction.A2);
      const output1 = buildNuclideId(reaction.E3, reaction.A3);
      const output2 = buildNuclideId(reaction.E4, reaction.A4);

      // Only include if both inputs are in active pool AND at least one output is new
      const hasNewOutput = !activeNuclides.has(output1) || !activeNuclides.has(output2);
      if (activeNuclides.has(input1) && activeNuclides.has(input2) && hasNewOutput) {
        allReactions.push({
          type: 'twotwo',
          inputs: [input1, input2],
          outputs: [output1, output2],
          MeV: reaction.MeV,
          loop: loopCount,
          neutrino: reaction.neutrino,
        });

        // Track products
        newProducts.add(output1);
        newProducts.add(output2);
        productDistribution.set(output1, (productDistribution.get(output1) || 0) + 1);
        productDistribution.set(output2, (productDistribution.get(output2) || 0) + 1);
      }
    }

    // Check for new products
    const hasNewProducts = Array.from(newProducts).some(p => !processedNuclides.has(p));

    if (!hasNewProducts) {
      // No new products - cascade terminates
      terminationReason = 'no_new_products';
      break;
    }

    // Feedback: add new products to active pool
    for (const product of newProducts) {
      activeNuclides.add(product);
      processedNuclides.add(product);
    }

    loopCount++;
  }

  // Check if we hit max loops
  if (loopCount >= params.maxLoops) {
    terminationReason = 'max_loops';
  }

  // Calculate total energy
  const totalEnergy = allReactions.reduce((sum, r) => sum + r.MeV, 0);

  // Collect all unique nuclides and elements involved
  const nuclideIds = new Set<string>();
  const elementSymbols = new Set<string>();

  for (const reaction of allReactions) {
    for (const nuclideId of [...reaction.inputs, ...reaction.outputs]) {
      nuclideIds.add(nuclideId);
      const { E } = parseNuclideId(nuclideId);
      elementSymbols.add(E);
    }
  }

  // Fetch nuclide and element data
  const allNuclidesData = await getAllNuclides(db);
  const allElementsData = await getAllElements(db);

  // Filter to only involved nuclides/elements
  const nuclides = allNuclidesData.filter(n =>
    nuclideIds.has(buildNuclideId(n.E, n.A))
  );
  const elements = allElementsData.filter(e =>
    elementSymbols.has(e.E)
  );

  const executionTime = performance.now() - startTime;

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
