import type { Database } from 'sql.js';
import type {
  CascadeParameters,
  CascadeResults,
  CascadeReaction,
  FuelNuclide,
} from '../types';
import { queryFusion, queryTwoToTwo, getAllNuclides, getAllElements } from './queryService';
import {
  normalizeFuelProportions,
  calculateReactionWeight,
  createEqualProportionFuel,
} from '../utils/fuelProportions';

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

  // Determine if weighted mode is enabled
  const useWeightedMode = params.useWeightedMode ?? false;

  // Parse and normalize fuel nuclides with proportions
  let fuelComposition: FuelNuclide[];
  if (typeof params.fuelNuclides[0] === 'string') {
    // Convert string array to FuelNuclide array
    const nuclideIds = parseFuelNuclides(params.fuelNuclides as string[]);
    fuelComposition = useWeightedMode
      ? createEqualProportionFuel(nuclideIds)
      : createEqualProportionFuel(nuclideIds);
  } else {
    // Already FuelNuclide array - normalize proportions
    fuelComposition = normalizeFuelProportions(params.fuelNuclides as FuelNuclide[]);
    // Parse nuclide IDs to ensure standard format
    fuelComposition = fuelComposition.map(fuel => ({
      ...fuel,
      nuclideId: parseFuelNuclides([fuel.nuclideId])[0],
    }));
  }

  if (fuelComposition.length === 0) {
    throw new Error('No valid fuel nuclides provided');
  }

  // Build proportions map for reaction weighting
  const proportions = new Map<string, number>();
  const fuelNuclideIds: string[] = [];
  for (const fuel of fuelComposition) {
    proportions.set(fuel.nuclideId, fuel.proportion);
    fuelNuclideIds.push(fuel.nuclideId);
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
        // Calculate reaction weight based on input proportions
        const weight = useWeightedMode
          ? calculateReactionWeight(input1, input2, proportions)
          : 1.0;

        allReactions.push({
          type: 'fusion',
          inputs: [input1, input2],
          outputs: [output],
          MeV: reaction.MeV,
          loop: loopCount,
          neutrino: reaction.neutrino,
          weight: useWeightedMode ? weight : undefined,
        });

        // Track product (weighted count)
        newProducts.add(output);
        productDistribution.set(output, (productDistribution.get(output) || 0) + weight);
        
        // Update proportions for feedback (products inherit weighted proportion)
        if (!proportions.has(output)) {
          proportions.set(output, weight);
        } else {
          proportions.set(output, proportions.get(output)! + weight);
        }
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
        // Calculate reaction weight based on input proportions
        const weight = useWeightedMode
          ? calculateReactionWeight(input1, input2, proportions)
          : 1.0;

        allReactions.push({
          type: 'twotwo',
          inputs: [input1, input2],
          outputs: [output1, output2],
          MeV: reaction.MeV,
          loop: loopCount,
          neutrino: reaction.neutrino,
          weight: useWeightedMode ? weight : undefined,
        });

        // Track products (weighted count)
        newProducts.add(output1);
        newProducts.add(output2);
        productDistribution.set(output1, (productDistribution.get(output1) || 0) + weight);
        productDistribution.set(output2, (productDistribution.get(output2) || 0) + weight);

        // Update proportions for feedback
        if (!proportions.has(output1)) {
          proportions.set(output1, weight);
        } else {
          proportions.set(output1, proportions.get(output1)! + weight);
        }
        if (!proportions.has(output2)) {
          proportions.set(output2, weight);
        } else {
          proportions.set(output2, proportions.get(output2)! + weight);
        }
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
    fuelComposition: useWeightedMode ? fuelComposition : undefined,
    isWeighted: useWeightedMode,
  };
}
