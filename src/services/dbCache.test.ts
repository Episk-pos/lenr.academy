import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  getCachedDB,
  setCachedDB,
  clearOldVersions,
  getAllCachedVersions,
  clearAllCache,
  requestPersistentStorage,
  fetchMetadata,
  checkForUpdate,
  CachedDatabase,
} from './dbCache'

/**
 * Helper to create a CachedDatabase record
 */
function makeCached(version: string, overrides?: Partial<CachedDatabase>): CachedDatabase {
  return {
    version,
    data: new Uint8Array([1, 2, 3]),
    size: 3,
    downloadedAt: Date.now(),
    ...overrides,
  }
}

describe('dbCache - IndexedDB operations', () => {
  beforeEach(async () => {
    // Clear the object store between tests (avoids deleteDatabase blocking on open connections)
    const req = indexedDB.open('ParkhomovCache', 1)
    const db = await new Promise<IDBDatabase>((resolve) => {
      req.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result
        if (!database.objectStoreNames.contains('databases')) {
          database.createObjectStore('databases', { keyPath: 'version' })
        }
      }
      req.onsuccess = () => resolve(req.result)
    })
    const tx = db.transaction('databases', 'readwrite')
    tx.objectStore('databases').clear()
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve()
    })
    db.close()
  })

  describe('setCachedDB', () => {
    it('stores a database entry', async () => {
      const cached = makeCached('v1.0.0')
      await setCachedDB(cached)

      const result = await getCachedDB('v1.0.0')
      expect(result).not.toBeNull()
      expect(result!.version).toBe('v1.0.0')
      expect(result!.size).toBe(3)
    })

    it('overwrites an existing version', async () => {
      await setCachedDB(makeCached('v1.0.0', { size: 100 }))
      await setCachedDB(makeCached('v1.0.0', { size: 200 }))

      const result = await getCachedDB('v1.0.0')
      expect(result!.size).toBe(200)
    })

    it('stores multiple versions', async () => {
      await setCachedDB(makeCached('v1.0.0'))
      await setCachedDB(makeCached('v2.0.0'))

      const all = await getAllCachedVersions()
      expect(all).toHaveLength(2)
    })
  })

  describe('getCachedDB', () => {
    it('returns null when no data is cached', async () => {
      const result = await getCachedDB()
      expect(result).toBeNull()
    })

    it('returns null for a non-existent version', async () => {
      await setCachedDB(makeCached('v1.0.0'))
      const result = await getCachedDB('v99.0.0')
      expect(result).toBeNull()
    })

    it('returns specific version when requested', async () => {
      await setCachedDB(makeCached('v1.0.0'))
      await setCachedDB(makeCached('v2.0.0'))

      const result = await getCachedDB('v1.0.0')
      expect(result!.version).toBe('v1.0.0')
    })

    it('returns most recently downloaded when no version specified', async () => {
      await setCachedDB(makeCached('v1.0.0', { downloadedAt: 1000 }))
      await setCachedDB(makeCached('v2.0.0', { downloadedAt: 2000 }))
      await setCachedDB(makeCached('v1.5.0', { downloadedAt: 3000 }))

      const result = await getCachedDB()
      expect(result!.version).toBe('v1.5.0')
    })

    it('preserves Uint8Array data', async () => {
      const data = new Uint8Array([10, 20, 30, 40, 50])
      await setCachedDB(makeCached('v1.0.0', { data, size: 5 }))

      const result = await getCachedDB('v1.0.0')
      // Compare raw byte values (IndexedDB may return a different typed array instance)
      expect(Array.from(new Uint8Array(result!.data))).toEqual([10, 20, 30, 40, 50])
    })

    it('preserves optional lastModified field', async () => {
      await setCachedDB(makeCached('v1.0.0', { lastModified: '2026-01-15T10:00:00Z' }))

      const result = await getCachedDB('v1.0.0')
      expect(result!.lastModified).toBe('2026-01-15T10:00:00Z')
    })
  })

  describe('clearOldVersions', () => {
    it('keeps only the specified version', async () => {
      await setCachedDB(makeCached('v1.0.0'))
      await setCachedDB(makeCached('v2.0.0'))
      await setCachedDB(makeCached('v3.0.0'))

      await clearOldVersions('v2.0.0')

      const all = await getAllCachedVersions()
      expect(all).toHaveLength(1)
      expect(all[0].version).toBe('v2.0.0')
    })

    it('does nothing when only the kept version exists', async () => {
      await setCachedDB(makeCached('v1.0.0'))

      await clearOldVersions('v1.0.0')

      const all = await getAllCachedVersions()
      expect(all).toHaveLength(1)
    })

    it('handles empty store gracefully', async () => {
      await expect(clearOldVersions('v1.0.0')).resolves.not.toThrow()
    })
  })

  describe('getAllCachedVersions', () => {
    it('returns empty array when nothing cached', async () => {
      const result = await getAllCachedVersions()
      expect(result).toEqual([])
    })

    it('returns all stored versions', async () => {
      await setCachedDB(makeCached('v1.0.0'))
      await setCachedDB(makeCached('v2.0.0'))

      const result = await getAllCachedVersions()
      expect(result).toHaveLength(2)
      const versions = result.map(r => r.version).sort()
      expect(versions).toEqual(['v1.0.0', 'v2.0.0'])
    })
  })

  describe('clearAllCache', () => {
    it('calls deleteDatabase and resolves within timeout', async () => {
      // clearAllCache uses indexedDB.deleteDatabase which may block if
      // connections are open. It has a built-in 2s timeout that resolves
      // regardless. We spy on deleteDatabase to verify it's called.
      const spy = vi.spyOn(indexedDB, 'deleteDatabase')

      await clearAllCache()

      expect(spy).toHaveBeenCalledWith('ParkhomovCache')
      spy.mockRestore()
    })
  })
})

describe('dbCache - requestPersistentStorage', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  it('returns true when persistent storage is granted', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        storage: { persist: vi.fn().mockResolvedValue(true) },
      },
      writable: true,
      configurable: true,
    })

    const result = await requestPersistentStorage()
    expect(result).toBe(true)
  })

  it('returns false when persistent storage is denied', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        storage: { persist: vi.fn().mockResolvedValue(false) },
      },
      writable: true,
      configurable: true,
    })

    const result = await requestPersistentStorage()
    expect(result).toBe(false)
  })

  it('returns false when storage API is not available', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator, storage: undefined },
      writable: true,
      configurable: true,
    })

    const result = await requestPersistentStorage()
    expect(result).toBe(false)
  })

  it('returns false when persist() throws', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        ...originalNavigator,
        storage: { persist: vi.fn().mockRejectedValue(new Error('denied')) },
      },
      writable: true,
      configurable: true,
    })

    const result = await requestPersistentStorage()
    expect(result).toBe(false)
  })
})

describe('dbCache - fetchMetadata', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns parsed metadata on success', async () => {
    const meta = { version: 'v1.2.3', size: 161000000, lastModified: '2026-01-01' }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(meta),
    })

    const result = await fetchMetadata()
    expect(result).toEqual(meta)
    expect(globalThis.fetch).toHaveBeenCalledWith('/parkhomov.db.meta.json')
  })

  it('throws on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    })

    await expect(fetchMetadata()).rejects.toThrow('Failed to fetch metadata')
  })

  it('throws on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))

    await expect(fetchMetadata()).rejects.toThrow('Network failure')
  })
})

describe('dbCache - checkForUpdate', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('reports update available when versions differ', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'v2.0.0', size: 100, lastModified: '2026-02-01' }),
    })

    const result = await checkForUpdate('v1.0.0')
    expect(result.hasUpdate).toBe(true)
    expect(result.metadata.version).toBe('v2.0.0')
  })

  it('reports no update when versions match', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'v1.0.0', size: 100, lastModified: '2026-01-01' }),
    })

    const result = await checkForUpdate('v1.0.0')
    expect(result.hasUpdate).toBe(false)
  })

  it('reports update available when no current version', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: 'v1.0.0', size: 100, lastModified: '2026-01-01' }),
    })

    const result = await checkForUpdate()
    expect(result.hasUpdate).toBe(true)
  })

  it('propagates fetch errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))

    await expect(checkForUpdate('v1.0.0')).rejects.toThrow('offline')
  })
})
