/**
 * Export utilities for query results (JSON and PDF formats).
 * CSV export is already implemented inline in each query page.
 */

import type { QueryFilter, ReactionType } from '../types'

interface ExportMetadata {
  queryType: ReactionType
  filter: QueryFilter
  executionTime: number
  rowCount: number
  totalCount: number
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

/**
 * Export query results as JSON with metadata
 */
export function exportToJSON(
  reactions: any[],
  metadata: ExportMetadata
) {
  if (reactions.length === 0) return

  const appVersion = (import.meta.env.VITE_APP_VERSION as string) || 'unknown'

  const output = {
    query: {
      type: metadata.queryType,
      parameters: metadata.filter,
      executedAt: new Date().toISOString(),
    },
    results: {
      reactions,
      statistics: {
        count: metadata.rowCount,
        totalMatching: metadata.totalCount,
        meanEnergy: reactions.length > 0
          ? reactions.reduce((sum, r) => sum + (r.MeV || 0), 0) / reactions.length
          : 0,
        minEnergy: reactions.length > 0
          ? reactions.reduce((min, r) => Math.min(min, r.MeV || 0), Infinity)
          : 0,
        maxEnergy: reactions.length > 0
          ? reactions.reduce((max, r) => Math.max(max, r.MeV || 0), -Infinity)
          : 0,
        executionTime: metadata.executionTime,
      },
    },
    metadata: {
      version: appVersion,
      exportedAt: new Date().toISOString(),
      source: 'LENR Academy - Nanosoft Suite',
    },
  }

  const json = JSON.stringify(output, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const date = new Date().toISOString().split('T')[0]
  downloadBlob(blob, `${metadata.queryType}_reactions_${date}.json`)
}

/**
 * Get column headers and row mapper for each reaction type
 */
function getColumnsForType(queryType: ReactionType): { headers: string[]; mapRow: (r: any) => any[] } {
  switch (queryType) {
    case 'fusion':
      return {
        headers: ['E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'E', 'Z', 'A', 'MeV', 'Neutrino'],
        mapRow: (r) => [r.E1, r.Z1, r.A1, r.E2, r.Z2, r.A2, r.E, r.Z, r.A, r.MeV?.toFixed(4), r.neutrino],
      }
    case 'fission':
      return {
        headers: ['E', 'Z', 'A', 'E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'MeV', 'Neutrino'],
        mapRow: (r) => [r.E, r.Z, r.A, r.E1, r.Z1, r.A1, r.E2, r.Z2, r.A2, r.MeV?.toFixed(4), r.neutrino],
      }
    case 'twotwo':
      return {
        headers: ['E1', 'Z1', 'A1', 'E2', 'Z2', 'A2', 'E3', 'Z3', 'A3', 'E4', 'Z4', 'A4', 'MeV', 'Neutrino'],
        mapRow: (r) => [r.E1, r.Z1, r.A1, r.E2, r.Z2, r.A2, r.E3, r.Z3, r.A3, r.E4, r.Z4, r.A4, r.MeV?.toFixed(4), r.neutrino],
      }
  }
}

/**
 * Get a human-readable title for the reaction type
 */
function getReactionTitle(queryType: ReactionType): string {
  switch (queryType) {
    case 'fusion': return 'Fusion Reactions (A + B → C)'
    case 'fission': return 'Fission Reactions (A → B + C)'
    case 'twotwo': return 'Two-To-Two Reactions (A + B → C + D)'
  }
}

/**
 * Format filter parameters for display
 */
function formatFilterSummary(filter: QueryFilter, queryType: ReactionType): string[] {
  const lines: string[] = []

  // Fission input element (skip if specific element lists are present to avoid redundancy)
  if (filter.elements?.length && !filter.element1List?.length && !filter.element2List?.length) {
    lines.push(`Input Element: ${filter.elements.join(', ')}`)
  }
  // Fusion/TwoToTwo input elements
  if (filter.element1List?.length) {
    const label = queryType === 'fission' ? 'Input Element' : 'Input Element 1'
    lines.push(`${label}: ${filter.element1List.join(', ')}`)
  }
  if (filter.element2List?.length) {
    lines.push(`Input Element 2: ${filter.element2List.join(', ')}`)
  }
  // Fusion output element
  if (filter.outputElementList?.length) {
    lines.push(`Output Element: ${filter.outputElementList.join(', ')}`)
  }
  // Fission output elements
  if (filter.outputElement1List?.length) {
    lines.push(`Output Element 1: ${filter.outputElement1List.join(', ')}`)
  }
  if (filter.outputElement2List?.length) {
    lines.push(`Output Element 2: ${filter.outputElement2List.join(', ')}`)
  }
  // TwoToTwo output elements
  if (filter.outputElement3List?.length) {
    lines.push(`Output Element 3: ${filter.outputElement3List.join(', ')}`)
  }
  if (filter.outputElement4List?.length) {
    lines.push(`Output Element 4: ${filter.outputElement4List.join(', ')}`)
  }
  if (filter.minMeV !== undefined) {
    lines.push(`Min Energy: ${filter.minMeV} MeV`)
  }
  if (filter.maxMeV !== undefined) {
    lines.push(`Max Energy: ${filter.maxMeV} MeV`)
  }
  if (filter.neutrinoType && filter.neutrinoType !== 'any') {
    lines.push(`Neutrino: ${filter.neutrinoType}`)
  }
  if (filter.limit) {
    lines.push(`Limit: ${filter.limit}`)
  }

  return lines.length > 0 ? lines : ['No filters applied']
}

/**
 * Export query results as PDF with table
 */
export async function exportToPDF(
  reactions: any[],
  metadata: ExportMetadata
) {
  if (reactions.length === 0) return

  // Dynamic import to avoid loading jsPDF until needed (~100KB)
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFontSize(18)
  doc.setTextColor(30, 64, 175) // primary blue
  doc.text('LENR Academy', 14, 15)

  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(getReactionTitle(metadata.queryType), 14, 24)

  // Query parameters - use splitTextToSize to prevent overflow
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  const filterLines = formatFilterSummary(metadata.filter, metadata.queryType)
  const filterText = `Query Parameters: ${filterLines.join(' | ')}`
  const maxTextWidth = pageWidth - 28 // 14mm margin each side
  const wrappedFilterLines: string[] = doc.splitTextToSize(filterText, maxTextWidth)
  doc.text(wrappedFilterLines, 14, 31)
  const filterEndY = 31 + (wrappedFilterLines.length - 1) * 4
  doc.text(`${metadata.rowCount} of ${metadata.totalCount} results | Exported ${new Date().toLocaleDateString()}`, 14, filterEndY + 5)

  // Divider line
  const dividerY = filterEndY + 8
  doc.setDrawColor(200, 200, 200)
  doc.line(14, dividerY, pageWidth - 14, dividerY)

  // Results table
  const { headers, mapRow } = getColumnsForType(metadata.queryType)
  const body = reactions.map(mapRow)

  autoTable(doc, {
    head: [headers],
    body,
    startY: dividerY + 3,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    didDrawPage: () => {
      // Footer on each page
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text(
        'LENR Academy - Nanosoft Suite | Based on work by Dr. Alexander Parkhomov',
        14,
        pageHeight - 8
      )
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      )
    },
  })

  const date = new Date().toISOString().split('T')[0]
  doc.save(`${metadata.queryType}_reactions_${date}.pdf`)
}
