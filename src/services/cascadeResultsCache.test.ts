import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  saveCascadeResults,
  getCascadeResults,
  deleteCascadeResults,
  cleanupOldResults,
} from './cascadeResultsCache';
import type { CascadeResults } from '../types';

function makeMockResults(overrides?: Partial<CascadeResults>): CascadeResults {
  return {
    reactions: [],
    productDistribution: new Map(),
    nuclides: [],
    elements: [],
    totalEnergy: 5,
    loopsExecuted: 10,
    executionTime: 42,
    terminationReason: 'max_loops' as const,
    ...overrides,
  };
}

describe('cascadeResultsCache', () => {
  beforeEach(async () => {
    const req = indexedDB.open('CascadeResultsCache', 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      req.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains('results')) {
          database.createObjectStore('results', { keyPath: 'tabId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
    const tx = db.transaction('results', 'readwrite');
    tx.objectStore('results').clear();
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });

  describe('saveCascadeResults', () => {
    it('stores results for a tab', async () => {
      await saveCascadeResults('tab-1', makeMockResults());
      const result = await getCascadeResults('tab-1');
      expect(result).not.toBeNull();
      expect(result!.totalEnergy).toBe(5);
    });

    it('overwrites results for same tab', async () => {
      await saveCascadeResults('tab-1', makeMockResults({ totalEnergy: 5 }));
      await saveCascadeResults('tab-1', makeMockResults({ totalEnergy: 99 }));
      const result = await getCascadeResults('tab-1');
      expect(result!.totalEnergy).toBe(99);
    });

    it('stores results for multiple tabs', async () => {
      await saveCascadeResults('tab-1', makeMockResults({ totalEnergy: 1 }));
      await saveCascadeResults('tab-2', makeMockResults({ totalEnergy: 2 }));
      const r1 = await getCascadeResults('tab-1');
      const r2 = await getCascadeResults('tab-2');
      expect(r1!.totalEnergy).toBe(1);
      expect(r2!.totalEnergy).toBe(2);
    });
  });

  describe('getCascadeResults', () => {
    it('returns null for non-existent tab', async () => {
      const result = await getCascadeResults('nonexistent');
      expect(result).toBeNull();
    });

    it('returns stored results for existing tab', async () => {
      await saveCascadeResults('tab-1', makeMockResults({ loopsExecuted: 42 }));
      const result = await getCascadeResults('tab-1');
      expect(result!.loopsExecuted).toBe(42);
    });
  });

  describe('deleteCascadeResults', () => {
    it('deletes results for a specific tab', async () => {
      await saveCascadeResults('tab-1', makeMockResults());
      await deleteCascadeResults('tab-1');
      const result = await getCascadeResults('tab-1');
      expect(result).toBeNull();
    });

    it('does not affect other tabs', async () => {
      await saveCascadeResults('tab-1', makeMockResults());
      await saveCascadeResults('tab-2', makeMockResults());
      await deleteCascadeResults('tab-1');
      const r2 = await getCascadeResults('tab-2');
      expect(r2).not.toBeNull();
    });

    it('handles deleting non-existent tab gracefully', async () => {
      await expect(deleteCascadeResults('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('cleanupOldResults', () => {
    it('does not delete recent results', async () => {
      await saveCascadeResults('recent-tab', makeMockResults());
      await cleanupOldResults();
      const result = await getCascadeResults('recent-tab');
      expect(result).not.toBeNull();
    });

    it('deletes results older than 7 days', async () => {
      const req = indexedDB.open('CascadeResultsCache', 1);
      const db = await new Promise<IDBDatabase>((resolve) => {
        req.onsuccess = () => resolve(req.result);
      });
      const tx = db.transaction('results', 'readwrite');
      tx.objectStore('results').put({
        tabId: 'old-tab',
        results: makeMockResults(),
        savedAt: Date.now() - (8 * 24 * 60 * 60 * 1000),
      });
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      db.close();

      await cleanupOldResults();
      const result = await getCascadeResults('old-tab');
      expect(result).toBeNull();
    });

    it('keeps recent while deleting old results', async () => {
      await saveCascadeResults('recent', makeMockResults({ totalEnergy: 1 }));

      const req = indexedDB.open('CascadeResultsCache', 1);
      const db = await new Promise<IDBDatabase>((resolve) => {
        req.onsuccess = () => resolve(req.result);
      });
      const tx = db.transaction('results', 'readwrite');
      tx.objectStore('results').put({
        tabId: 'old',
        results: makeMockResults({ totalEnergy: 99 }),
        savedAt: Date.now() - (10 * 24 * 60 * 60 * 1000),
      });
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
      db.close();

      await cleanupOldResults();

      const recent = await getCascadeResults('recent');
      const old = await getCascadeResults('old');
      expect(recent).not.toBeNull();
      expect(old).toBeNull();
    });

    it('handles empty store gracefully', async () => {
      await expect(cleanupOldResults()).resolves.not.toThrow();
    });
  });
});
