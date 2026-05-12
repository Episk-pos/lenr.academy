import { describe, it, expect } from 'vitest'
import {
  getCurrentVersion,
  getDatabase,
  exportDatabase,
} from './database'

// We test the exported utility functions that don't require full database init
// Full init requires sql.js WASM which isn't available in jsdom

describe('database service', () => {
  describe('getCurrentVersion', () => {
    it('returns null before initialization', () => {
      // getCurrentVersion reads module-level state
      // Since we're in a fresh test, it should be null
      expect(getCurrentVersion()).toBeNull()
    })
  })

  describe('getDatabase', () => {
    it('throws when database is not initialized', () => {
      expect(() => getDatabase()).toThrow('Database not initialized. Call initDatabase() first.')
    })
  })

  describe('exportDatabase', () => {
    it('throws when database is not initialized', () => {
      expect(() => exportDatabase()).toThrow('Database not initialized')
    })
  })
})
