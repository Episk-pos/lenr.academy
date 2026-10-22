/**
 * Shared Tailwind classes for toggle/filter chips (pill buttons), used by the
 * Muller band selector, threshold selector and similar filter rows so they
 * all look the same.
 */
export function filterChipClass(active: boolean): string {
  return `inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800 ${
    active
      ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500'
      : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100 hover:border-gray-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
  }`
}
