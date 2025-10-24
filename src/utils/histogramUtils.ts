// Utility functions for energy histogram calculations

export interface BinData {
  binStart: number;
  binEnd: number;
  count: number;
  binCenter: number;
}

export interface EnergyStatistics {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  range: number;
}

/**
 * Calculate optimal bin size using Sturges' rule
 * k = ceil(log2(n) + 1)
 */
export function calculateSturgesBinSize(dataCount: number, range: number): number {
  if (dataCount === 0 || range === 0) return 1;

  const binCount = Math.ceil(Math.log2(dataCount) + 1);
  return range / binCount;
}

/**
 * Calculate histogram bins from energy values
 */
export function calculateBins(
  energyValues: number[],
  binSize?: number
): BinData[] {
  if (energyValues.length === 0) return [];

  const min = Math.min(...energyValues);
  const max = Math.max(...energyValues);
  const range = max - min;

  // Use provided bin size or auto-calculate using Sturges' rule
  const effectiveBinSize = binSize || calculateSturgesBinSize(energyValues.length, range);

  // Handle edge case where all values are the same
  if (range === 0) {
    return [{
      binStart: min,
      binEnd: min,
      count: energyValues.length,
      binCenter: min
    }];
  }

  // Create bins
  const binCount = Math.ceil(range / effectiveBinSize);
  const bins: BinData[] = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = min + (i * effectiveBinSize);
    const binEnd = binStart + effectiveBinSize;
    const binCenter = binStart + (effectiveBinSize / 2);

    bins.push({
      binStart,
      binEnd,
      count: 0,
      binCenter
    });
  }

  // Count values in each bin
  energyValues.forEach(value => {
    const binIndex = Math.min(
      Math.floor((value - min) / effectiveBinSize),
      bins.length - 1
    );
    bins[binIndex].count++;
  });

  return bins;
}

/**
 * Calculate statistical metrics for energy distribution
 */
export function calculateStatistics(energyValues: number[]): EnergyStatistics {
  if (energyValues.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      range: 0
    };
  }

  const count = energyValues.length;
  const sorted = [...energyValues].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  // Mean
  const sum = energyValues.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  // Median
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];

  // Standard deviation
  const squaredDiffs = energyValues.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    count,
    mean,
    median,
    min,
    max,
    stdDev,
    range
  };
}

/**
 * Format energy value for display
 */
export function formatEnergy(value: number): string {
  return value.toFixed(2);
}

/**
 * Format bin label for display
 */
export function formatBinLabel(binStart: number, binEnd: number): string {
  return `${formatEnergy(binStart)} - ${formatEnergy(binEnd)}`;
}
