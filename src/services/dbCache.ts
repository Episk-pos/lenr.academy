/**
 * IndexedDB-based cache for the Parkhomov database
 * Supports versioning and background updates
 */

const DB_NAME = 'ParkhomovCache';
const DB_VERSION = 1;
const STORE_NAME = 'databases';

export interface CachedDatabase {
  version: string;
  data: Uint8Array;
  size: number;
  downloadedAt: number;
  lastModified?: string;
}

export interface DatabaseMetadata {
  version: string;
  size: number;
  lastModified: string;
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
        db.createObjectStore(STORE_NAME, { keyPath: 'version' });
      }
    };
  });
}

/**
 * Request persistent storage to prevent eviction
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(isPersisted
        ? '✅ Persistent storage granted'
        : '⚠️ Persistent storage denied - data may be evicted');
      return isPersisted;
    } catch (error) {
      console.warn('Failed to request persistent storage:', error);
      return false;
    }
  }
  return false;
}

/**
 * Get cached database by version (or latest if version not specified)
 */
export async function getCachedDB(version?: string): Promise<CachedDatabase | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    if (version) {
      // Get specific version
      const request = store.get(version);
      const result = await new Promise<CachedDatabase | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return result || null;
    } else {
      // Get all versions and return the latest
      const request = store.getAll();
      const results = await new Promise<CachedDatabase[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (results.length === 0) return null;

      // Sort by downloadedAt and return most recent
      results.sort((a, b) => b.downloadedAt - a.downloadedAt);
      return results[0];
    }
  } catch (error) {
    console.error('Failed to get cached database:', error);
    return null;
  }
}

/**
 * Store database in IndexedDB cache
 */
export async function setCachedDB(cached: CachedDatabase): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(cached);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`✅ Cached database version ${cached.version} (${(cached.size / 1024 / 1024).toFixed(1)} MB)`);
  } catch (error) {
    console.error('Failed to cache database:', error);
    throw error;
  }
}

/**
 * Clear old database versions, keeping only the specified version
 */
export async function clearOldVersions(keepVersion: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Get all versions
    const request = store.getAllKeys();
    const versions = await new Promise<IDBValidKey[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Delete all except keepVersion
    const deletePromises = versions
      .filter(version => version !== keepVersion)
      .map(version => {
        return new Promise<void>((resolve, reject) => {
          const deleteRequest = store.delete(version);
          deleteRequest.onsuccess = () => {
            console.log(`🗑️ Deleted old database version: ${version}`);
            resolve();
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Failed to clear old versions:', error);
  }
}

/**
 * Get all cached database versions
 */
export async function getAllCachedVersions(): Promise<CachedDatabase[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.getAll();
    return await new Promise<CachedDatabase[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to get all cached versions:', error);
    return [];
  }
}

/**
 * Clear all cached databases
 */
export async function clearAllCache(): Promise<void> {
  return new Promise<void>((resolve) => {
    console.log('🗑️ Attempting to delete IndexedDB database:', DB_NAME);

    // Aggressive timeout - resolve quickly to allow page reload
    const timeout = setTimeout(() => {
      console.warn('⚠️ Delete operation timed out after 2s, proceeding with reload');
      resolve();
    }, 2000); // 2 second timeout (reduced from 5)

    try {
      // Delete the entire IndexedDB database directly
      const request = indexedDB.deleteDatabase(DB_NAME);

      request.onsuccess = () => {
        clearTimeout(timeout);
        console.log('✅ Successfully deleted IndexedDB database');
        resolve();
      };

      request.onerror = () => {
        clearTimeout(timeout);
        console.error('❌ Failed to delete IndexedDB:', request.error);
        // Don't reject - we'll reload anyway and try to recover
        resolve();
      };

      request.onblocked = () => {
        console.warn('⚠️ Delete blocked by open connections');
        // Let timeout handle this - we'll reload anyway
      };
    } catch (err) {
      clearTimeout(timeout);
      console.error('❌ Exception during IndexedDB deletion:', err);
      resolve();
    }
  });
}

/**
 * Fetch database metadata from server
 */
export async function fetchMetadata(): Promise<DatabaseMetadata> {
  try {
    const response = await fetch('/parkhomov.db.meta.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch database metadata:', error);
    throw error;
  }
}

/**
 * Check if an update is available
 */
export async function checkForUpdate(currentVersion?: string): Promise<{ hasUpdate: boolean; metadata: DatabaseMetadata }> {
  const metadata = await fetchMetadata();

  if (!currentVersion) {
    return { hasUpdate: true, metadata };
  }

  const hasUpdate = metadata.version !== currentVersion;
  return { hasUpdate, metadata };
}
