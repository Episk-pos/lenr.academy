/**
 * Pathway Analysis Service
 *
 * Analyzes cascade reactions to identify patterns:
 * - De-duplicates reactions into unique pathways
 * - Detects feedback loops (products that become inputs)
 * - Calculates frequency, energy, and rarity metrics
 * - Ranks pathways for pattern discovery
 */

export interface PathwayAnalysis {
  pathway: string;           // Human-readable: "H-1 + Li-7 → He-4"
  type: 'fusion' | 'twotwo';
  inputs: string[];
  outputs: string[];
  frequency: number;         // How many times this pathway occurs
  avgEnergy: number;         // Average MeV per occurrence
  totalEnergy: number;       // Total MeV across all occurrences
  loops: number[];           // Which loop numbers this pathway appears in
  isFeedback: boolean;       // Does an output become an input later?
  rarityScore: number;       // 0-100, where 100 = most common pathway
}

interface Reaction {
  type: 'fusion' | 'twotwo';
  inputs: string[];
  outputs: string[];
  MeV: number;
  loop: number;
}

/**
 * Analyze cascade reactions to extract pathway patterns
 */
export function analyzePathways(reactions: Reaction[]): PathwayAnalysis[] {
  if (reactions.length === 0) return [];

  // Step 1: De-duplicate reactions into unique pathways
  const pathwayMap = new Map<string, {
    type: string;
    inputs: string[];
    outputs: string[];
    count: number;
    totalEnergy: number;
    loops: Set<number>;
  }>();

  reactions.forEach((reaction) => {
    // Create unique key for this pathway
    const pathwayKey = `${reaction.inputs.join('+')}→${reaction.outputs.join('+')}`;

    if (pathwayMap.has(pathwayKey)) {
      const existing = pathwayMap.get(pathwayKey)!;
      existing.count++;
      existing.totalEnergy += reaction.MeV;
      existing.loops.add(reaction.loop);
    } else {
      pathwayMap.set(pathwayKey, {
        type: reaction.type,
        inputs: reaction.inputs,
        outputs: reaction.outputs,
        count: 1,
        totalEnergy: reaction.MeV,
        loops: new Set([reaction.loop]),
      });
    }
  });

  // Step 2: Detect feedback loops
  // Build map of nuclides and the loops where they appear as outputs
  const outputLoops = new Map<string, Set<number>>();
  reactions.forEach((r) => {
    r.outputs.forEach((output) => {
      if (!outputLoops.has(output)) {
        outputLoops.set(output, new Set());
      }
      outputLoops.get(output)!.add(r.loop);
    });
  });

  // Build map of nuclides and the loops where they appear as inputs
  const inputLoops = new Map<string, Set<number>>();
  reactions.forEach((r) => {
    r.inputs.forEach((input) => {
      if (!inputLoops.has(input)) {
        inputLoops.set(input, new Set());
      }
      inputLoops.get(input)!.add(r.loop);
    });
  });

  // A pathway has feedback if its output appears as input in a later loop
  function hasFeedbackLoop(pathway: { outputs: string[]; loops: Set<number> }): boolean {
    return pathway.outputs.some((output) => {
      // Check if this output appears as an input at all
      const inputLoopsForNuclide = inputLoops.get(output);
      if (!inputLoopsForNuclide) return false;

      // Check if this output appears as input in a loop after it was first produced
      const earliestOutput = Math.min(...Array.from(outputLoops.get(output) || []));
      const laterInputLoops = Array.from(inputLoopsForNuclide).filter(loop => loop > earliestOutput);

      return laterInputLoops.length > 0;
    });
  }

  // Step 3: Calculate rarity scores
  const maxFrequency = Math.max(...Array.from(pathwayMap.values()).map((p) => p.count));

  // Step 4: Build analysis results
  const analyses: PathwayAnalysis[] = [];
  pathwayMap.forEach((data, key) => {
    analyses.push({
      pathway: key.replace(/\+/g, ' + ').replace(/→/, ' → '),
      type: data.type as 'fusion' | 'twotwo',
      inputs: data.inputs,
      outputs: data.outputs,
      frequency: data.count,
      avgEnergy: data.totalEnergy / data.count,
      totalEnergy: data.totalEnergy,
      loops: Array.from(data.loops).sort((a, b) => a - b),
      isFeedback: hasFeedbackLoop(data),
      rarityScore: (data.count / maxFrequency) * 100,
    });
  });

  // Sort by frequency (descending) by default
  analyses.sort((a, b) => b.frequency - a.frequency);

  return analyses;
}

/**
 * Filter pathways by criteria
 */
export interface PathwayFilter {
  minFrequency?: number;
  minEnergy?: number;
  maxCount?: number;         // Limit to top N pathways
  showFusion?: boolean;
  showTwoToTwo?: boolean;
  feedbackOnly?: boolean;
  searchTerm?: string;       // Filter by nuclide name
}

export function filterPathways(
  pathways: PathwayAnalysis[],
  filter: PathwayFilter
): PathwayAnalysis[] {
  let filtered = [...pathways];

  // Apply filters
  if (filter.minFrequency !== undefined) {
    filtered = filtered.filter((p) => p.frequency >= filter.minFrequency!);
  }

  if (filter.minEnergy !== undefined) {
    filtered = filtered.filter((p) => p.avgEnergy >= filter.minEnergy!);
  }

  if (filter.showFusion !== undefined || filter.showTwoToTwo !== undefined) {
    const showFusion = filter.showFusion ?? true;
    const showTwoToTwo = filter.showTwoToTwo ?? true;
    filtered = filtered.filter((p) => {
      if (p.type === 'fusion') return showFusion;
      if (p.type === 'twotwo') return showTwoToTwo;
      return false;
    });
  }

  if (filter.feedbackOnly) {
    filtered = filtered.filter((p) => p.isFeedback);
  }

  if (filter.searchTerm) {
    const term = filter.searchTerm.toLowerCase();
    filtered = filtered.filter((p) =>
      p.inputs.some((n) => n.toLowerCase().includes(term)) ||
      p.outputs.some((n) => n.toLowerCase().includes(term))
    );
  }

  // Apply max count limit (top N)
  if (filter.maxCount !== undefined && filter.maxCount > 0) {
    filtered = filtered.slice(0, filter.maxCount);
  }

  return filtered;
}

/**
 * Get statistics about pathways
 */
export interface PathwayStats {
  totalPathways: number;
  totalReactions: number;
  feedbackCount: number;
  avgFrequency: number;
  avgEnergy: number;
  mostCommon: PathwayAnalysis | null;
  highestEnergy: PathwayAnalysis | null;
}

export function getPathwayStats(pathways: PathwayAnalysis[]): PathwayStats {
  if (pathways.length === 0) {
    return {
      totalPathways: 0,
      totalReactions: 0,
      feedbackCount: 0,
      avgFrequency: 0,
      avgEnergy: 0,
      mostCommon: null,
      highestEnergy: null,
    };
  }

  const totalReactions = pathways.reduce((sum, p) => sum + p.frequency, 0);
  const feedbackCount = pathways.filter((p) => p.isFeedback).length;
  const avgFrequency = totalReactions / pathways.length;
  const avgEnergy = pathways.reduce((sum, p) => sum + p.avgEnergy, 0) / pathways.length;

  // Most common pathway (highest frequency)
  const mostCommon = pathways.reduce((max, p) => (p.frequency > max.frequency ? p : max), pathways[0]);

  // Highest energy pathway
  const highestEnergy = pathways.reduce((max, p) => (p.avgEnergy > max.avgEnergy ? p : max), pathways[0]);

  return {
    totalPathways: pathways.length,
    totalReactions,
    feedbackCount,
    avgFrequency,
    avgEnergy,
    mostCommon,
    highestEnergy,
  };
}
