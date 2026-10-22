import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

/**
 * Transient hover highlight for the reaction query pages.
 *
 * Hovering a nuclide card used to set page-level state, which re-rendered the
 * whole query page (results table, heatmap, charts) on every mouse move. The
 * hover value now lives in a tiny external store; only components that read it
 * via `useHoverHighlight` re-render, and only when their selected slice changes.
 *
 * Usage (page owns one store for its lifetime):
 *   const [hoverStore] = useState(createHoverHighlightStore)
 *   <HoverHighlightContext.Provider value={hoverStore}>…</HoverHighlightContext.Provider>
 *
 * Pinned state is NOT stored here — it stays in the page because it drives
 * filtering, URL sync and the details panel.
 */
export interface HoverHighlightState {
  /** Hovered nuclide id in `${E}-${A}` form, or null */
  nuclide: string | null
}

export interface HoverHighlightStore {
  getState: () => HoverHighlightState
  setNuclide: (nuclide: string | null) => void
  subscribe: (listener: () => void) => () => void
}

const EMPTY_STATE: HoverHighlightState = { nuclide: null }

export function createHoverHighlightStore(): HoverHighlightStore {
  let state: HoverHighlightState = EMPTY_STATE
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    setNuclide: (nuclide) => {
      if (state.nuclide === nuclide) return
      state = { ...state, nuclide }
      listeners.forEach(listener => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const HoverHighlightContext = createContext<HoverHighlightStore | null>(null)

/** The store from the nearest provider, or null when rendered outside one. */
export function useHoverHighlightStore(): HoverHighlightStore | null {
  return useContext(HoverHighlightContext)
}

const noopSubscribe = () => () => {}

/**
 * Subscribe to a slice of the hover state. The component re-renders only when
 * the selected value changes (compare by Object.is), so selectors should
 * return primitives. Outside a provider this returns `selector(EMPTY_STATE)`.
 */
export function useHoverHighlight<T>(selector: (state: HoverHighlightState) => T): T {
  const store = useContext(HoverHighlightContext)
  const getSnapshot = useCallback(
    () => selector(store ? store.getState() : EMPTY_STATE),
    [store, selector]
  )
  return useSyncExternalStore(store ? store.subscribe : noopSubscribe, getSnapshot, getSnapshot)
}
