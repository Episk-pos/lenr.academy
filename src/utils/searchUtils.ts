/**
 * Search utility functions for filtering tabular data with priority-based matching
 */

/**
 * Element info for name-based searching
 */
export interface ElementInfo {
  symbol: string;  // E.g., "He"
  name: string;    // E.g., "Helium"
  Z: number;       // Atomic number
}

/**
 * Metadata for enhanced searching with element names and daughter nuclides
 */
export interface SearchMetadata {
  elements?: ElementInfo[];  // Array of elements with symbol, name, and Z
  daughterNuclideGetter?: (row: any) => { E?: string; Z?: number; A?: number } | null;  // Function to get daughter nuclide from row
}

/**
 * Parse nuclide notation (In-49, In49, in-49, in49) to extract element and mass number
 */
export function parseNuclideNotation(search: string): { element?: string; massNumber?: number } | null {
  // Try formats: E-A, EA (e.g., "In-49", "In49", "in-49", "in49")
  const withDash = search.match(/^([A-Za-z]{1,2})-?(\d+)$/)
  if (withDash) {
    return {
      element: withDash[1],
      massNumber: parseInt(withDash[2])
    }
  }
  return null
}

/**
 * Find element symbols that match a search term against element names
 * Returns Map of element symbol to match score
 */
export function findElementsByName(search: string, elements: ElementInfo[]): Map<string, number> {
  const matches = new Map<string, number>()

  elements.forEach(el => {
    const score = getMatchScore(el.name, search)
    if (score > 0) {
      matches.set(el.symbol, score)
    }
  })

  return matches
}

/**
 * Calculate match quality score (higher = better match)
 * Scoring hierarchy:
 * - 1000: Exact case-sensitive match
 * - 900: Exact case-insensitive match
 * - 800: Starts with (case-sensitive)
 * - 700: Starts with (case-insensitive)
 * - 600: Contains exact substring (case-sensitive)
 * - 500: Contains substring (case-insensitive)
 * - 100: Fuzzy match (all characters present in order)
 * - 0: No match
 */
export function getMatchScore(value: string, search: string): number {
  const valueLower = value.toLowerCase()
  const searchLower = search.toLowerCase()

  // Exact case-sensitive match (highest priority)
  if (value === search) return 1000

  // Exact case-insensitive match
  if (valueLower === searchLower) return 900

  // Starts with (case-sensitive)
  if (value.startsWith(search)) return 800

  // Starts with (case-insensitive)
  if (valueLower.startsWith(searchLower)) return 700

  // Contains exact substring (case-sensitive)
  if (value.includes(search)) return 600

  // Contains substring (case-insensitive)
  if (valueLower.includes(searchLower)) return 500

  // Fuzzy match (all characters present in order)
  let searchIdx = 0
  for (let i = 0; i < valueLower.length && searchIdx < searchLower.length; i++) {
    if (valueLower[i] === searchLower[searchIdx]) {
      searchIdx++
    }
  }
  if (searchIdx === searchLower.length) return 100

  return 0
}

/**
 * Filter and sort data by search term with priority-based matching
 * Supports nuclide notation (In-49, In49) for data with 'E' and 'A' columns
 * Supports element name searching when metadata is provided
 * Supports daughter nuclide searching for decay data when metadata is provided
 */
export function filterDataBySearch<T extends Record<string, any>>(
  data: T[],
  columns: Array<{ key: string }>,
  searchTerm: string,
  metadata?: SearchMetadata
): T[] {
  if (!searchTerm) return data

  const nuclideMatch = parseNuclideNotation(searchTerm)

  // Find element symbols that match the search term by name (returns Map of symbol → score)
  let elementNameScores = new Map<string, number>()
  if (metadata?.elements) {
    elementNameScores = findElementsByName(searchTerm, metadata.elements)
  }

  // Create array of {row, score} for priority sorting
  const scoredResults = data.map(row => {
    let maxScore = 0

    // Check for nuclide notation match (In-49, In49, etc.) - PARENT nuclide
    if (nuclideMatch) {
      const rowE = row['E'] || row['element']
      const rowA = row['A']

      // Match element symbol and mass number
      if (rowE && rowA !== undefined) {
        const elementMatch = getMatchScore(String(rowE), nuclideMatch.element || '')
        if (elementMatch > 0 && rowA === nuclideMatch.massNumber) {
          maxScore = Math.max(maxScore, 3500) // Highest priority for parent nuclide notation
        }
      }
    }

    // Check if element symbol matches element name search - PARENT
    if (elementNameScores.size > 0) {
      const rowE = row['E'] || row['element']
      const nameScore = elementNameScores.get(String(rowE))
      if (nameScore !== undefined) {
        // Base of 2000 + actual name match score (0-1000) = 2000-3000 range
        maxScore = Math.max(maxScore, 2000 + nameScore)
      }
    }

    // Check for nuclide notation match - DAUGHTER nuclide (decays only)
    if (nuclideMatch && metadata?.daughterNuclideGetter) {
      const daughter = metadata.daughterNuclideGetter(row)
      if (daughter && daughter.E && daughter.A !== undefined) {
        const elementMatch = getMatchScore(String(daughter.E), nuclideMatch.element || '')
        if (elementMatch > 0 && daughter.A === nuclideMatch.massNumber) {
          maxScore = Math.max(maxScore, 1500) // Medium priority for daughter nuclide notation
        }
      }
    }

    // Check if element symbol matches element name search - DAUGHTER (decays only)
    if (elementNameScores.size > 0 && metadata?.daughterNuclideGetter) {
      const daughter = metadata.daughterNuclideGetter(row)
      const nameScore = daughter?.E ? elementNameScores.get(String(daughter.E)) : undefined
      if (nameScore !== undefined) {
        // Base of 1000 + actual name match score for daughter (1000-2000 range)
        maxScore = Math.max(maxScore, 1000 + nameScore)
      }
    }

    // Check all columns for matches (including Z, A, etc.)
    columns.forEach(col => {
      const value = row[col.key]
      if (value != null) {
        const valueStr = String(value)
        const score = getMatchScore(valueStr, searchTerm)
        maxScore = Math.max(maxScore, score)
      }
    })

    return { row, score: maxScore }
  })

  // Filter out non-matches and sort by score
  return scoredResults
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.row)
}
