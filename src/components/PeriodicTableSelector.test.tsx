import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import en from '../i18n/locales/en.json'
import { mockReactI18next } from '../test-utils/i18nMock'

vi.mock('react-i18next', () => mockReactI18next)
vi.mock('../contexts/DatabaseContext', () => ({
  useDatabase: () => ({ db: null }),
}))

import PeriodicTableSelector from './PeriodicTableSelector'

function renderSelector() {
  return render(
    <div>
      <button type="button">outside</button>
      <PeriodicTableSelector
        label="Element 1"
        availableElements={[]}
        selectedElements={[]}
        onSelectionChange={vi.fn()}
        testId="selector-trigger"
      />
    </div>
  )
}

function open() {
  fireEvent.click(screen.getByTestId('selector-trigger'))
  expect(screen.getByTestId('periodic-table-dropdown')).toBeInTheDocument()
}

describe('PeriodicTableSelector dropdown / mobile sheet', () => {
  it('wraps the grid in a horizontal scroll container', () => {
    renderSelector()
    open()
    const scroller = screen.getByTestId('periodic-table-scroll')
    expect(scroller.className).toContain('overflow-x-auto')
    // Desktop keeps the original non-scrolling layout
    expect(scroller.className).toContain('sm:overflow-visible')
  })

  it('closes from the mobile close button', () => {
    renderSelector()
    open()
    const dropdown = screen.getByTestId('periodic-table-dropdown')
    const closeButton = Array.from(dropdown.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === en.common.close
    )
    expect(closeButton).toBeDefined()
    fireEvent.click(closeButton!)
    expect(screen.queryByTestId('periodic-table-dropdown')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderSelector()
    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('periodic-table-dropdown')).not.toBeInTheDocument()
  })

  it('closes on outside click but not on clicks inside the panel', () => {
    renderSelector()
    open()
    fireEvent.mouseDown(screen.getByTestId('periodic-table-dropdown'))
    expect(screen.getByTestId('periodic-table-dropdown')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByTestId('periodic-table-dropdown')).not.toBeInTheDocument()
  })
})
