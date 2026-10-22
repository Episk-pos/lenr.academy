import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { memo } from 'react'
import {
  HoverHighlightContext,
  createHoverHighlightStore,
  useHoverHighlight,
} from './HoverHighlightContext'
import type { HoverHighlightState } from './HoverHighlightContext'

const selectNuclide = (s: HoverHighlightState) => s.nuclide
const selectIsFe56 = (s: HoverHighlightState) => s.nuclide === 'Fe-56'

describe('HoverHighlightContext', () => {
  it('store notifies subscribers only on actual changes', () => {
    const store = createHoverHighlightStore()
    let calls = 0
    const unsubscribe = store.subscribe(() => { calls++ })
    store.setNuclide('Fe-56')
    store.setNuclide('Fe-56')
    store.setNuclide(null)
    expect(calls).toBe(2)
    unsubscribe()
    store.setNuclide('Ni-58')
    expect(calls).toBe(2)
    expect(store.getState().nuclide).toBe('Ni-58')
  })

  it('returns the empty state outside a provider', () => {
    function Reader() {
      return <span data-testid="value">{String(useHoverHighlight(selectNuclide))}</span>
    }
    render(<Reader />)
    expect(screen.getByTestId('value')).toHaveTextContent('null')
  })

  it('hovering re-renders only subscribers whose selected slice changed', () => {
    const store = createHoverHighlightStore()
    const renders = { page: 0, unrelated: 0, hoverReader: 0, fe56Reader: 0 }

    // Stands in for the results table / heatmap: no hover subscription
    const Unrelated = memo(function Unrelated() {
      renders.unrelated++
      return null
    })
    // Stands in for the nuclide section
    function HoverReader() {
      renders.hoverReader++
      return <span data-testid="hovered">{String(useHoverHighlight(selectNuclide))}</span>
    }
    // Narrow selector: only cares whether Fe-56 is hovered
    function Fe56Reader() {
      renders.fe56Reader++
      return <span data-testid="fe56">{String(useHoverHighlight(selectIsFe56))}</span>
    }
    function Page() {
      renders.page++
      return (
        <HoverHighlightContext.Provider value={store}>
          <Unrelated />
          <HoverReader />
          <Fe56Reader />
        </HoverHighlightContext.Provider>
      )
    }

    render(<Page />)
    expect(renders).toEqual({ page: 1, unrelated: 1, hoverReader: 1, fe56Reader: 1 })

    act(() => store.setNuclide('Ni-58'))
    expect(screen.getByTestId('hovered')).toHaveTextContent('Ni-58')
    expect(renders).toEqual({ page: 1, unrelated: 1, hoverReader: 2, fe56Reader: 1 })

    act(() => store.setNuclide('Fe-56'))
    expect(screen.getByTestId('fe56')).toHaveTextContent('true')
    expect(renders).toEqual({ page: 1, unrelated: 1, hoverReader: 3, fe56Reader: 2 })

    act(() => store.setNuclide(null))
    expect(screen.getByTestId('hovered')).toHaveTextContent('null')
    expect(renders.page).toBe(1)
    expect(renders.unrelated).toBe(1)
  })
})
