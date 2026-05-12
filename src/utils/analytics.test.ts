import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isUmamiLoaded } from './analytics'

describe('analytics', () => {
  beforeEach(() => {
    document.querySelectorAll('script[src*="umami"]').forEach(s => s.remove())
  })

  afterEach(() => {
    document.querySelectorAll('script[src*="umami"]').forEach(s => s.remove())
  })

  describe('isUmamiLoaded', () => {
    it('returns false when no Umami script is present', () => {
      expect(isUmamiLoaded()).toBe(false)
    })

    it('returns true when Umami script is present', () => {
      const script = document.createElement('script')
      script.src = 'https://cloud.umami.is/script.js'
      document.head.appendChild(script)

      expect(isUmamiLoaded()).toBe(true)
    })
  })
})
