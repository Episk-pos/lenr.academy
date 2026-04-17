/**
 * Shared external link components for use with react-i18next Trans component.
 * These are self-closing <a> elements — Trans fills in the children from the i18n string.
 */

const linkClass = 'underline hover:text-primary-600 dark:hover:text-primary-400 transition-colors'

export const parkhomovLink = (
  <a href="https://lenr-canr.org/wordpress/?page_id=1081"
    target="_blank" rel="noopener noreferrer"
    className={linkClass} />
)

export const mfmpLink = (
  <a href="http://www.quantumheat.org/"
    target="_blank" rel="noopener noreferrer"
    className={linkClass} />
)

export const nanosoftLink = (
  <a href="https://nanosoft.co.nz"
    target="_blank" rel="noopener noreferrer"
    className={linkClass} />
)
