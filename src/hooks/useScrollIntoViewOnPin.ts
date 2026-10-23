import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/**
 * Scroll `ref` into view when the user pins something new.
 *
 * Fires when `pinKey` changes to a new non-null value while `enabled` was
 * already true on the previous render. It does not fire on mount, on unpin
 * (`pinKey` -> null), or on the render where `enabled` first becomes true, so
 * pins restored from URL state during initialisation don't scroll the page.
 *
 * The scroll is deferred one animation frame so the details for the new pin
 * (fetched in a page effect) have rendered first. Focus is never moved.
 */
export function useScrollIntoViewOnPin<T extends HTMLElement>(
  ref: RefObject<T | null>,
  pinKey: string | null,
  enabled = true
): void {
  const prevKeyRef = useRef(pinKey)
  const prevEnabledRef = useRef(enabled)

  useEffect(() => {
    const prevKey = prevKeyRef.current
    const wasEnabled = prevEnabledRef.current
    prevKeyRef.current = pinKey
    prevEnabledRef.current = enabled

    if (!enabled || !wasEnabled) return
    if (pinKey === null || pinKey === prevKey) return

    const frame = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'nearest',
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [ref, pinKey, enabled])
}
