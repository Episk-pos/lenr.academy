import { useCallback, useState } from 'react'

/**
 * Minimum viewport width (px) at which boson/fermion (B/F) type columns are
 * shown by default on the reaction query pages. Below this width the columns
 * are hidden by default to keep the results table readable.
 */
export const BOSON_FERMION_DEFAULT_MIN_WIDTH = 1024

/** Default B/F column visibility for the current viewport (wide = shown). */
export function getDefaultBosonFermionVisibility(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth >= BOSON_FERMION_DEFAULT_MIN_WIDTH
}

function readStoredPreference(storageKey: string): boolean | null {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === null) return null
    const parsed = JSON.parse(saved)
    return typeof parsed === 'boolean' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Shared B/F column visibility state for the Fusion, Fission and Two-to-Two
 * query pages.
 *
 * - An explicit user preference (persisted in localStorage under `storageKey`)
 *   always wins.
 * - Otherwise the columns are shown on wide (desktop) screens and hidden on
 *   narrow ones — the same default on every query page.
 * - The preference is only persisted when it is explicitly set, so the
 *   responsive default keeps applying until the user toggles it.
 */
export function useBosonFermionVisibility(storageKey: string) {
  const [show, setShowState] = useState<boolean>(
    () => readStoredPreference(storageKey) ?? getDefaultBosonFermionVisibility()
  )

  const setShow = useCallback(
    (value: boolean) => {
      setShowState(value)
      try {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        // Ignore storage errors (private mode, quota)
      }
    },
    [storageKey]
  )

  return [show, setShow] as const
}
