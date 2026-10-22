/**
 * Locale-aware "time ago" formatting for UI timestamps (e.g. query history).
 *
 * Uses Intl.RelativeTimeFormat with numeric: 'auto' so that the smallest
 * bucket reads naturally ("now", "jetzt", "अभी") rather than "0 seconds ago".
 * Anything older than a week falls back to a localized calendar date.
 */
export function formatTimeAgo(timestamp: number, locale: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  const lang = locale || 'en'

  let rtf: Intl.RelativeTimeFormat
  try {
    rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  }

  if (seconds < 60) return rtf.format(0, 'second')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return rtf.format(-days, 'day')

  try {
    return new Date(timestamp).toLocaleDateString(lang)
  } catch {
    return new Date(timestamp).toLocaleDateString('en')
  }
}
