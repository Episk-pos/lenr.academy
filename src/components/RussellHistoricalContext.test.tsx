import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RussellHistoricalContext from './RussellHistoricalContext'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}))

describe('RussellHistoricalContext', () => {
  it('renders the component', () => {
    render(<RussellHistoricalContext />)
    expect(screen.getByTestId('russell-historical-context')).toBeInTheDocument()
  })

  it('displays the title', () => {
    render(<RussellHistoricalContext />)
    expect(screen.getByText('russellHistory.title')).toBeInTheDocument()
  })

  it('displays the subtitle', () => {
    render(<RussellHistoricalContext />)
    expect(screen.getByText('russellHistory.subtitle')).toBeInTheDocument()
  })

  it('renders all 5 collapsible sections', () => {
    render(<RussellHistoricalContext />)

    expect(screen.getByText('russellHistory.whoWasRussell.title')).toBeInTheDocument()
    expect(screen.getByText('russellHistory.nineOctaveStructure.title')).toBeInTheDocument()
    expect(screen.getByText('russellHistory.westinghouse.title')).toBeInTheDocument()
    expect(screen.getByText('russellHistory.modernReplication.title')).toBeInTheDocument()
    expect(screen.getByText('russellHistory.vortexCone.title')).toBeInTheDocument()
  })

  it('all sections are collapsed by default', () => {
    render(<RussellHistoricalContext />)

    const buttons = screen.getAllByRole('button', { expanded: false })
    // 5 section buttons should be collapsed
    expect(buttons.length).toBeGreaterThanOrEqual(5)
  })

  it('expands a section on click', () => {
    render(<RussellHistoricalContext />)

    const firstSection = screen.getByText('russellHistory.whoWasRussell.title')
    fireEvent.click(firstSection)

    // Content should now be visible
    expect(screen.getByText('russellHistory.whoWasRussell.p1')).toBeInTheDocument()
    expect(screen.getByText('russellHistory.whoWasRussell.p2')).toBeInTheDocument()
    expect(screen.getByText('russellHistory.whoWasRussell.p3')).toBeInTheDocument()
  })

  it('collapses an expanded section on second click', () => {
    render(<RussellHistoricalContext />)

    const firstSection = screen.getByText('russellHistory.whoWasRussell.title')
    fireEvent.click(firstSection) // expand
    fireEvent.click(firstSection) // collapse

    // The button should be collapsed again
    const button = firstSection.closest('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('has an expand all button', () => {
    render(<RussellHistoricalContext />)
    expect(screen.getByText('russellHistory.expandAll')).toBeInTheDocument()
  })

  it('expands all sections with expand all button', () => {
    render(<RussellHistoricalContext />)

    const expandAll = screen.getByText('russellHistory.expandAll')
    fireEvent.click(expandAll)

    // All 5 section buttons should now be expanded (toggle button may also have aria-expanded)
    const expandedButtons = screen.getAllByRole('button', { expanded: true })
    expect(expandedButtons.length).toBeGreaterThanOrEqual(5)
  })

  it('shows collapse all button when all are expanded', () => {
    render(<RussellHistoricalContext />)

    const expandAll = screen.getByText('russellHistory.expandAll')
    fireEvent.click(expandAll)

    expect(screen.getByText('russellHistory.collapseAll')).toBeInTheDocument()
  })

  it('collapses all with collapse all button', () => {
    render(<RussellHistoricalContext />)

    // Expand all first
    fireEvent.click(screen.getByText('russellHistory.expandAll'))
    // Then collapse all
    fireEvent.click(screen.getByText('russellHistory.collapseAll'))

    const collapsedButtons = screen.getAllByRole('button', { expanded: false })
    expect(collapsedButtons.length).toBeGreaterThanOrEqual(5)
  })

  it('renders highlight boxes for sections that have them', () => {
    render(<RussellHistoricalContext />)

    // Expand the first section which has a highlight
    fireEvent.click(screen.getByText('russellHistory.whoWasRussell.title'))

    expect(screen.getByText('russellHistory.whoWasRussell.highlight')).toBeInTheDocument()
  })
})
