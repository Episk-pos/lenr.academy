/**
 * Format utilities for displaying scientific data
 */

/**
 * Expands abbreviated half-life units to full words
 * @param abbreviation - Abbreviated unit from database (e.g., 'ms', 'µs', 'y')
 * @returns Full unit name (e.g., 'milliseconds', 'microseconds', 'years')
 */
export function expandHalfLifeUnit(abbreviation: string | null): string {
  if (!abbreviation) return ''

  const unitMap: Record<string, string> = {
    'fs': 'femtoseconds',
    'ps': 'picoseconds',
    'ns': 'nanoseconds',
    'µs': 'microseconds',
    'us': 'microseconds', // Alternative ASCII representation
    'ms': 'milliseconds',
    's': 'seconds',
    'm': 'minutes',
    'h': 'hours',
    'd': 'days',
    'y': 'years',
  }

  return unitMap[abbreviation] || abbreviation
}
