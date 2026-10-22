/**
 * Minimal non-blocking notice for code paths outside React (e.g. export
 * utilities). Renders a small auto-dismissing banner at the bottom of the
 * viewport. Theme-aware via Tailwind `dark:` variants (the ThemeProvider puts
 * the `dark` class on <html>).
 */
export function showTransientNotice(message: string, durationMs = 6000): void {
  if (typeof document === 'undefined') return

  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  el.className =
    'fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] max-w-md px-4 py-2 rounded-lg shadow-lg text-sm ' +
    'border bg-amber-50 text-amber-900 border-amber-300 ' +
    'dark:bg-amber-900/90 dark:text-amber-100 dark:border-amber-700'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => el.remove(), durationMs)
}
