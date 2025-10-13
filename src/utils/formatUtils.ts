/**
 * Format utilities for displaying scientific data
 */

/**
 * Formats half-life units for display
 * Sub-second units: Keep as SI abbreviations (fs, ps, ns, µs, ms)
 * Second and above: Expand to full words (seconds, minutes, hours, days, years)
 * @param abbreviation - Abbreviated unit from database (e.g., 'ms', 'µs', 'Y')
 * @returns Formatted unit (e.g., 'ms', 'µs', 'years')
 */
export function expandHalfLifeUnit(abbreviation: string | null): string {
  if (!abbreviation) return ''

  const unitMap: Record<string, string> = {
    // Sub-second units - keep as SI abbreviations (concise and standard)
    'fs': 'fs',
    'ps': 'ps',
    'ns': 'ns',
    'µs': 'µs',
    'us': 'µs',  // Normalize ASCII to proper Greek µ
    'ms': 'ms',

    // Second and longer - expand to full words (more readable)
    's': 'seconds',
    'm': 'minutes',
    'h': 'hours',
    'd': 'days',
    'y': 'years',

    // Uppercase versions (database sometimes uses uppercase)
    'FS': 'fs',
    'PS': 'ps',
    'NS': 'ns',
    'µS': 'µs',
    'US': 'µs',
    'MS': 'ms',
    'S': 'seconds',
    'M': 'minutes',
    'H': 'hours',
    'D': 'days',
    'Y': 'years',
  }

  return unitMap[abbreviation] || abbreviation
}
