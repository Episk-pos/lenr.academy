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

/**
 * Normalizes element symbols for hydrogen isotopes to their periodic table representation.
 * D (Deuterium) and T (Tritium) map to H (Hydrogen) for periodic table highlighting.
 * @param elementSymbol - Element symbol from database (e.g., 'D', 'T', 'H', 'C')
 * @returns Normalized element symbol (e.g., 'H', 'H', 'H', 'C')
 */
export function normalizeElementSymbol(elementSymbol: string): string {
  if (elementSymbol === 'D' || elementSymbol === 'T') {
    return 'H'
  }
  return elementSymbol
}

/**
 * Densities below this threshold (in kg/m³) are gases at STP and are displayed in g/L.
 * The least dense non-gas in the database is lithium (534 kg/m³); the densest gas is radon (9.73 kg/m³).
 */
const GAS_DENSITY_THRESHOLD_KG_M3 = 100

/**
 * Formats an STP density stored in the database (ElementPropertiesPlus.STPDensity, kg/m³).
 * Solids/liquids are shown in g/cm³ (3 decimals); gases are shown in g/L (4 significant figures),
 * which avoids unreadable values like 0.0000899 g/cm³ for hydrogen.
 * @param kgPerM3 - Density in kg/m³ (e.g. Fe = 7874, H = 0.0899)
 * @returns e.g. '7.874 g/cm³' or '0.0899 g/L'
 */
export function formatDensity(kgPerM3: number): string {
  if (Math.abs(kgPerM3) < GAS_DENSITY_THRESHOLD_KG_M3) {
    // 1 kg/m³ == 1 g/L
    return `${Number(kgPerM3.toPrecision(4))} g/L`
  }
  return `${(kgPerM3 / 1000).toFixed(3)} g/cm³`
}

/**
 * Converts an STP density from the database's kg/m³ to g/cm³.
 */
export function densityToGPerCm3(kgPerM3: number): number {
  return kgPerM3 / 1000
}

/**
 * Formats a specific heat stored in the database (ElementPropertiesPlus.SpecHeat, J/(kg·K))
 * as J/(g·K) with 3 decimals.
 * @param jPerKgK - Specific heat in J/(kg·K) (e.g. Fe = 449, H = 14300)
 * @returns e.g. '0.449 J/(g·K)'
 */
export function formatSpecificHeat(jPerKgK: number): string {
  return `${(jPerKgK / 1000).toFixed(3)} J/(g·K)`
}
