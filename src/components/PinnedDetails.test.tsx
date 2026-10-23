import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import PinnedDetails from './PinnedDetails'
import type { Element, Nuclide } from '../types'

vi.mock('./ElementDetailsCard', () => ({
  default: ({ element, onClose }: { element: Element; onClose?: () => void }) => (
    <div data-testid="element-details-card">
      Atomic Number: {element.Z}
      {onClose && <button onClick={onClose}>close-element</button>}
    </div>
  ),
}))

vi.mock('./NuclideDetailsCard', () => ({
  default: ({ nuclide, onClose }: { nuclide: Nuclide; onClose?: () => void }) => (
    <div data-testid="nuclide-details-card">
      {nuclide.E}-{nuclide.A}
      {onClose && <button onClick={onClose}>close-nuclide</button>}
    </div>
  ),
}))

const fe56 = { E: 'Fe', A: 56, Z: 26 } as Nuclide
const iron = { Z: 26, E: 'Fe', EName: 'Iron' } as Element
const noop = () => {}

describe('PinnedDetails', () => {
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

  it('shows the empty-state hint inline when nothing is pinned (no dialog)', () => {
    render(<PinnedDetails nuclide={null} element={null} atomicRadii={null} onCloseNuclide={noop} onCloseElement={noop} />)
    expect(screen.getByTestId('details-empty-state')).toHaveTextContent('Details')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('PinnedDetails scroll into view on pin', () => {
  let reducedMotion = false
  const originalMatchMedia = window.matchMedia
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  let scrollIntoView: ReturnType<typeof vi.fn>

  beforeEach(() => {
    reducedMotion = false
    scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView as unknown as typeof HTMLElement.prototype.scrollIntoView
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0)
      return 0
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    vi.restoreAllMocks()
  })

  /** Mimics a query page: pins come from user clicks, or from URL state during init. */
  function Harness({ initialPin = null, initialised = true }: { initialPin?: string | null; initialised?: boolean }) {
    const [pinned, setPinned] = useState<string | null>(initialPin)
    const [ready, setReady] = useState(initialised)
    return (
      <div>
        <button onClick={() => setPinned(p => (p === 'Fe-56' ? null : 'Fe-56'))}>pin-fe56</button>
        <button onClick={() => setPinned('Ni-58')}>pin-ni58</button>
        <button
          onClick={() => {
            // URL-state restore: pin and mark initialised in the same update
            setPinned('Fe-56')
            setReady(true)
          }}
        >
          restore-from-url
        </button>
        <PinnedDetails
          nuclide={pinned ? fe56 : null}
          element={pinned ? iron : null}
          atomicRadii={null}
          onCloseNuclide={() => setPinned(null)}
          onCloseElement={() => setPinned(null)}
          pinKey={pinned ? `|${pinned}` : null}
          scrollOnPin={ready}
        />
      </div>
    )
  }

  it('does not scroll on mount, even with a pin already set', () => {
    render(<Harness initialPin="Fe-56" />)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('smoothly scrolls the details into view when the user pins', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'pin-fe56' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' })
    expect(scrollIntoView.mock.instances[0]).toBe(screen.getByTestId('pinned-details'))
  })

  it('scrolls again when the pin changes to a different selection', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'pin-fe56' }))
    fireEvent.click(screen.getByRole('button', { name: 'pin-ni58' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('does not scroll on unpin', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'pin-fe56' }))
    scrollIntoView.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'pin-fe56' }))
    expect(screen.getByTestId('details-empty-state')).toBeInTheDocument()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('does not scroll when a pin is restored from URL state during initialisation', () => {
    render(<Harness initialised={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'restore-from-url' }))
    expect(screen.getByTestId('nuclide-details-card')).toBeInTheDocument()
    expect(scrollIntoView).not.toHaveBeenCalled()
    // Later user pins do scroll
    fireEvent.click(screen.getByRole('button', { name: 'pin-ni58' }))
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('uses an instant scroll when the user prefers reduced motion', () => {
    reducedMotion = true
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'pin-fe56' }))
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' })
  })

  it('never moves focus', () => {
    render(<Harness />)
    const pinButton = screen.getByRole('button', { name: 'pin-fe56' })
    pinButton.focus()
    act(() => {
      fireEvent.click(pinButton)
    })
    expect(document.activeElement).toBe(pinButton)
  })
})
