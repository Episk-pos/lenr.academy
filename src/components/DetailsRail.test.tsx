import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import DetailsRail, { PinnedDetails } from './DetailsRail'
import type { Element, Nuclide } from '../types'

vi.mock('./ElementDetailsCard', () => ({
  default: ({ element, onClose, compact }: { element: Element; onClose?: () => void; compact?: boolean }) => (
    <div data-testid="element-details-card" data-compact={String(!!compact)}>
      Atomic Number: {element.Z}
      {onClose && <button onClick={onClose}>close-element</button>}
    </div>
  ),
}))

vi.mock('./NuclideDetailsCard', () => ({
  default: ({ nuclide, onClose, compact }: { nuclide: Nuclide; onClose?: () => void; compact?: boolean }) => (
    <div data-testid="nuclide-details-card" data-compact={String(!!compact)}>
      {nuclide.E}-{nuclide.A}
      {onClose && <button onClick={onClose}>close-nuclide</button>}
    </div>
  ),
}))

// --- matchMedia mock -------------------------------------------------------
let wide = false
const mqlListeners = new Set<() => void>()
const originalMatchMedia = window.matchMedia

function setWide(next: boolean) {
  wide = next
  act(() => {
    mqlListeners.forEach(listener => listener())
  })
}

beforeEach(() => {
  wide = false
  mqlListeners.clear()
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return query === '(min-width: 1280px)' ? wide : false
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => mqlListeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => mqlListeners.delete(cb),
    addListener: (cb: () => void) => mqlListeners.add(cb),
    removeListener: (cb: () => void) => mqlListeners.delete(cb),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
  document.body.style.overflow = ''
})

// --- Harness mimicking a query page ---------------------------------------
const fe56 = { E: 'Fe', A: 56, Z: 26 } as Nuclide
const iron = { Z: 26, E: 'Fe', EName: 'Iron' } as Element

function Harness() {
  const [pinned, setPinned] = useState<string | null>(null)
  return (
    <div>
      <button onClick={() => setPinned(p => (p ? null : 'Fe-56'))}>pin-fe56</button>
      <button>other-page-button</button>
      <DetailsRail pinKey={pinned ? `|${pinned}` : null}>
        <PinnedDetails
          nuclide={pinned ? fe56 : null}
          element={pinned ? iron : null}
          atomicRadii={null}
          onCloseNuclide={() => setPinned(null)}
          onCloseElement={() => setPinned(null)}
        />
      </DetailsRail>
    </div>
  )
}

const pinButton = () => screen.getByRole('button', { name: 'pin-fe56' })

describe('DetailsRail', () => {
  describe('rail mode (>= 1280px)', () => {
    beforeEach(() => {
      wide = true
    })

    it('renders a sticky complementary rail with the empty-state hint', () => {
      render(<Harness />)
      const rail = screen.getByTestId('details-rail')
      expect(rail.tagName).toBe('ASIDE')
      expect(rail).toHaveAttribute('aria-label', 'Details')
      expect(rail.className).toContain('sticky')
      expect(rail.className).toContain('max-h-[calc(100vh-2rem)]')
      expect(rail.className).toContain('overflow-y-auto')
      expect(screen.getByText(/Click on an element or a nuclide above to see detailed properties/)).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByTestId('details-drawer-trigger')).toBeNull()
    })

    it('shows pinned details inside the rail without opening a drawer', () => {
      render(<Harness />)
      fireEvent.click(pinButton())
      const rail = screen.getByTestId('details-rail')
      expect(rail).toContainElement(screen.getByTestId('element-details-card'))
      expect(rail).toContainElement(screen.getByTestId('nuclide-details-card'))
      expect(screen.getByTestId('nuclide-details-card')).toHaveAttribute('data-compact', 'true')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByTestId('details-drawer-trigger')).toBeNull()
    })
  })

  describe('drawer mode (< 1280px)', () => {
    it('renders nothing in flow while nothing is pinned', () => {
      render(<Harness />)
      expect(screen.queryByTestId('details-rail')).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByTestId('details-drawer-trigger')).toBeNull()
      expect(screen.queryByText(/Click on an element or a nuclide above/)).toBeNull()
    })

    it('auto-opens a modal dialog when something is pinned', () => {
      render(<Harness />)
      fireEvent.click(pinButton())
      const dialog = screen.getByRole('dialog', { name: 'Details' })
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toContainElement(screen.getByTestId('nuclide-details-card'))
      expect(dialog).toContainElement(screen.getByTestId('element-details-card'))
      // Focus moves into the drawer and background scrolling is locked
      expect(screen.getByRole('button', { name: 'Close details' })).toHaveFocus()
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('closes on Escape without unpinning and restores focus to the trigger', () => {
      render(<Harness />)
      pinButton().focus()
      fireEvent.click(pinButton())
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(pinButton()).toHaveFocus()
      expect(document.body.style.overflow).toBe('')
      // Still pinned: the floating Details button is offered to reopen
      const trigger = screen.getByTestId('details-drawer-trigger')
      expect(trigger).toHaveTextContent('Details')
      fireEvent.click(trigger)
      expect(screen.getByRole('dialog')).toContainElement(screen.getByTestId('nuclide-details-card'))
    })

    it('closes on backdrop click without unpinning', () => {
      render(<Harness />)
      fireEvent.click(pinButton())
      fireEvent.click(screen.getByTestId('details-drawer-backdrop'))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByTestId('details-drawer-trigger')).toBeInTheDocument()
    })

    it('closes via the close button', () => {
      render(<Harness />)
      fireEvent.click(pinButton())
      fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByTestId('details-drawer-trigger')).toBeInTheDocument()
    })

    it('traps Tab focus inside the drawer', () => {
      render(<Harness />)
      fireEvent.click(pinButton())
      const closeButton = screen.getByRole('button', { name: 'Close details' })
      const lastButton = screen.getByRole('button', { name: 'close-nuclide' })

      // Shift+Tab from the first focusable wraps to the last
      closeButton.focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      expect(lastButton).toHaveFocus()

      // Tab from the last focusable wraps to the first
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(closeButton).toHaveFocus()

      // Focus that escaped the dialog is pulled back in
      screen.getByRole('button', { name: 'other-page-button' }).focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      expect(closeButton).toHaveFocus()
    })

    it('closes the drawer and hides the trigger when the pin is cleared', () => {
      render(<Harness />)
      fireEvent.click(pinButton())
      // Unpin from inside the drawer (card close button)
      fireEvent.click(screen.getByRole('button', { name: 'close-nuclide' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByTestId('details-drawer-trigger')).toBeNull()
    })

    it('switches to the rail when the viewport grows', () => {
      render(<Harness />)
      fireEvent.click(pinButton())
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      setWide(true)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByTestId('details-rail')).toContainElement(screen.getByTestId('nuclide-details-card'))
    })
  })
})

describe('PinnedDetails', () => {
  const noop = () => {}

  it('shows element then nuclide card for a pinned nuclide, both closing the nuclide pin', () => {
    const onCloseNuclide = vi.fn()
    const onCloseElement = vi.fn()
    render(
      <PinnedDetails nuclide={fe56} element={iron} atomicRadii={null} onCloseNuclide={onCloseNuclide} onCloseElement={onCloseElement} />
    )
    const element = screen.getByTestId('element-details-card')
    const nuclide = screen.getByTestId('nuclide-details-card')
    expect(element.compareDocumentPosition(nuclide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'close-element' }))
    fireEvent.click(screen.getByRole('button', { name: 'close-nuclide' }))
    expect(onCloseNuclide).toHaveBeenCalledTimes(2)
    expect(onCloseElement).not.toHaveBeenCalled()
  })

  it('shows only the element card for a pinned element', () => {
    const onCloseElement = vi.fn()
    render(<PinnedDetails nuclide={null} element={iron} atomicRadii={null} onCloseNuclide={noop} onCloseElement={onCloseElement} />)
    expect(screen.queryByTestId('nuclide-details-card')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'close-element' }))
    expect(onCloseElement).toHaveBeenCalledTimes(1)
  })

  it('shows the empty-state hint when nothing is pinned', () => {
    render(<PinnedDetails nuclide={null} element={null} atomicRadii={null} onCloseNuclide={noop} onCloseElement={noop} />)
    expect(screen.getByTestId('details-empty-state')).toHaveTextContent('Details')
  })
})
