/** Minimum gap between a fixed-position dropdown and the viewport edges (px) */
export const VIEWPORT_MARGIN = 8
/** Minimum dropdown width (px) */
export const MIN_DROPDOWN_WIDTH = 200

export interface DropdownPosition {
  top: number
  left: number
  width: number
}

type AnchorRect = Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right' | 'width'>

/**
 * Viewport-fixed position for the language dropdown, anchored to its trigger.
 *
 * - 'below' (mobile header): the menu hangs from the trigger's inline-end edge
 *   (right edge in LTR, left edge in RTL).
 * - 'above' (desktop sidebar): the menu opens upwards from the trigger's
 *   inline-start edge (left edge in LTR, right edge in RTL). The caller applies
 *   translateY(-100%).
 *
 * In both directions `left` is clamped to [margin, viewportWidth - width - margin]
 * so the menu never clips off-screen.
 */
export function computeDropdownPosition(
  rect: AnchorRect,
  position: 'above' | 'below',
  isRtl: boolean,
  viewportWidth: number,
): DropdownPosition {
  const width = Math.max(rect.width, MIN_DROPDOWN_WIDTH)
  let left: number
  if (position === 'below') {
    left = isRtl ? rect.left : rect.right - width
  } else {
    left = isRtl ? rect.right - width : rect.left
  }
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - width - VIEWPORT_MARGIN))
  const top = position === 'below' ? rect.bottom + VIEWPORT_MARGIN : rect.top - VIEWPORT_MARGIN
  return { top, left, width }
}

/** Tallest the dropdown may be (px) before it scrolls */
export const MAX_DROPDOWN_HEIGHT = 480
/** Never shrink below this (px), even if the trigger leaves less room: scrolling beats clipping to nothing */
export const MIN_DROPDOWN_HEIGHT = 160

/**
 * Max height for a dropdown anchored like computeDropdownPosition, so a long
 * list (25 languages) scrolls inside the viewport instead of running off it:
 * the space below the trigger for 'below', above it for 'above'.
 */
export function computeDropdownMaxHeight(
  rect: Pick<DOMRect, 'top' | 'bottom'>,
  position: 'above' | 'below',
  viewportHeight: number,
): number {
  const available = position === 'below'
    ? viewportHeight - rect.bottom - 2 * VIEWPORT_MARGIN
    : rect.top - 2 * VIEWPORT_MARGIN
  return Math.max(MIN_DROPDOWN_HEIGHT, Math.min(MAX_DROPDOWN_HEIGHT, available))
}
