/**
 * IndexedDB-based cache for cascade simulation results
 * Stores large cascade results separately from localStorage to avoid QuotaExceededError
 */

import { CascadeResults } from '../types';

const DB_NAME = 'CascadeResultsCache';
const DB_VERSION = 1;
const STORE_NAME = 'results';

export interface CachedCascadeResults {
  tabId: string;
  results: CascadeResults;
  savedAt: number;
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'tabId' });
      }
    };
  });
}

/**
 * Save cascade results to IndexedDB
 */
export async function saveCascadeResults(
  tabId: string,
  results: CascadeResults
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cached: CachedCascadeResults = {
      tabId,
      results,
      savedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(cached);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error('Failed to save cascade results to IndexedDB:', error);
    throw error;
  }
}

/**
 * Get cascade results from IndexedDB
 */
export async function getCascadeResults(
  tabId: string
): Promise<CascadeResults | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const result = await new Promise<CachedCascadeResults | undefined>(
      (resolve, reject) => {
        const request = store.get(tabId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }
    );

    db.close();
    return result?.results || null;
  } catch (error) {
    console.error('Failed to load cascade results from IndexedDB:', error);
    return null;
  }
}

/**
 * Delete cascade results for a specific tab
 */
export async function deleteCascadeResults(tabId: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(tabId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error('Failed to delete cascade results from IndexedDB:', error);
  }
}

/**
 * Cleanup old cascade results (older than 7 days)
 */
export async function cleanupOldResults(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    const request = store.openCursor();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const cached = cursor.value as CachedCascadeResults;
          // Check if older than 7 days
          if (now - cached.savedAt > maxAge) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    db.close();
  } catch (error) {
    console.error('Failed to cleanup old cascade results:', error);
  }
}
