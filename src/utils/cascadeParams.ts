/**
 * Helpers for the Cascades page "Max Nuclides to Pair" setting.
 *
 * The cascade stops once more than `maxNuclides` distinct nuclides are active.
 * Since the active set can never exceed the number of nuclides in the
 * database, the slider's upper bound (and default) is the DB nuclide count.
 */

/** Lower bound of the Max Nuclides slider */
export const MIN_MAX_NUCLIDES = 10

/**
 * Used only until the database reports its real nuclide count
 * (matches the current parkhomov.db NuclidesPlus row count).
 */
export const FALLBACK_NUCLIDE_COUNT = 324

/** Normalise a DB-reported nuclide count, falling back when unavailable */
export function resolveNuclideCount(count: number | null | undefined): number {
  return typeof count === 'number' && Number.isFinite(count) && count > 0
    ? Math.floor(count)
    : FALLBACK_NUCLIDE_COUNT
}

/** Clamp a user/URL/saved maxNuclides value into [MIN_MAX_NUCLIDES, nuclideCount] */
export function clampMaxNuclides(value: number, nuclideCount: number): number {
  const upper = Math.max(MIN_MAX_NUCLIDES, nuclideCount)
  if (!Number.isFinite(value)) return upper
  return Math.min(Math.max(Math.round(value), MIN_MAX_NUCLIDES), upper)
}

/**
 * Effective maxNuclides once the DB count is known: an explicit value
 * (URL or restored state) is clamped; otherwise the default is the DB count.
 */
export function deriveMaxNuclides(
  current: number,
  nuclideCount: number,
  explicit: boolean
): number {
  return explicit ? clampMaxNuclides(current, nuclideCount) : Math.max(MIN_MAX_NUCLIDES, nuclideCount)
}
