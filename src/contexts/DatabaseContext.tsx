import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Database } from 'sql.js';
import { initDatabase, downloadUpdate, getCurrentVersion, type DownloadProgress } from '../services/database';
import { clearAllCache } from '../services/dbCache';
import MeteredConnectionWarning from '../components/MeteredConnectionWarning';

// Utility to detect metered connection
function isMeteredConnection(): boolean {
  // TESTING MODE: Uncomment the line below to simulate metered connection
  // return true;

  // Check if Network Information API is available (experimental)
  // This API is available as navigator.connection or navigator.mozConnection or navigator.webkitConnection
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (conn) {
    // Log browser info to help diagnose false positives
    const userAgent = navigator.userAgent;
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const isChrome = /chrome/i.test(userAgent) && !/edg/i.test(userAgent);

    console.log('📡 Network connection info:', {
      browser: isSafari ? 'Safari' : isChrome ? 'Chrome' : 'Other',
      userAgent: userAgent.substring(0, 100),
      type: conn.type,
      effectiveType: conn.effectiveType,
      saveData: conn.saveData,
      downlink: conn.downlink,
      rtt: conn.rtt,
      metered: conn.metered
    });

    // Check if user has enabled data saver (most reliable indicator)
    if (conn.saveData === true) {
      console.log('⚠️ Data saver enabled - treating as metered');
      return true;
    }

    // PRIMARY CHECK: Check actual connection type (not speed)
    // conn.type indicates the physical connection medium
    if (conn.type === 'cellular') {
      console.log('⚠️ Cellular connection detected via type property');
      return true;
    }

    // SECONDARY CHECK: If type is not available, check for slow effective types
    // Note: effectiveType describes SPEED, not connection medium
    // '4g' and '5g' indicate FAST connections (likely WiFi), so we exclude them
    // Only very slow connections (2g, 3g) are likely to be cellular
    const slowEffectiveTypes = ['slow-2g', '2g', '3g'];
    if (conn.effectiveType && slowEffectiveTypes.includes(conn.effectiveType)) {
      console.log('⚠️ Slow connection detected:', conn.effectiveType, '(may be cellular)');
      return true;
    }

    // TERTIARY CHECK: Connection explicitly marked as metered (rarely supported)
    if (typeof conn.metered === 'boolean' && conn.metered) {
      console.log('⚠️ Connection explicitly marked as metered');
      return true;
    }

    console.log('✅ Connection appears to be unmetered');
  } else {
    console.log('ℹ️ Network Information API not available - metered detection disabled');
  }

  return false;
}

const METERED_WARNING_KEY = 'lenr-metered-download-consent';
const DATABASE_SIZE_MB = 154; // Size of parkhomov.db

export interface DatabaseContextType {
  db: Database | null;
  isLoading: boolean;
  error: Error | null;
  // Progress tracking
  downloadProgress: DownloadProgress | null;
  // Update management
  currentVersion: string | null;
  availableVersion: string | null;
  isUpdateAvailable: boolean;
  isDownloadingUpdate: boolean;
  updateReady: boolean;
  // Actions
  startBackgroundUpdate: () => void;
  reloadWithNewVersion: () => void;
  clearDatabaseCache: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  isLoading: true,
  error: null,
  downloadProgress: null,
  currentVersion: null,
  availableVersion: null,
  isUpdateAvailable: false,
  isDownloadingUpdate: false,
  updateReady: false,
  startBackgroundUpdate: () => {},
  reloadWithNewVersion: () => {},
  clearDatabaseCache: async () => {},
});

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [showMeteredWarning, setShowMeteredWarning] = useState(false);
  const [meteredConfirmed, setMeteredConfirmed] = useState(false);

  useEffect(() => {
    async function loadDatabase() {
      try {
        console.log('🔄 Initializing database...');

        // Check for metered connection and prior consent
        const metered = isMeteredConnection();
        const previousConsent = localStorage.getItem(METERED_WARNING_KEY);

        if (metered && previousConsent !== 'accepted') {
          console.log('⚠️ Metered connection detected, showing warning...');
          setShowMeteredWarning(true);
          setIsLoading(true);
          return; // Wait for user confirmation
        }

        const database = await initDatabase(
          // Progress callback
          (progress) => {
            setDownloadProgress(progress);
          },
          // Update available callback
          (version) => {
            setAvailableVersion(version);
          }
        );

        setDb(database);
        setCurrentVersion(getCurrentVersion());
        setIsLoading(false);
        setDownloadProgress(null);
        console.log('✅ Database ready!');
      } catch (err) {
        console.error('❌ Database initialization failed:', err);
        setError(err instanceof Error ? err : new Error('Failed to initialize database'));
        setIsLoading(false);
      }
    }

    loadDatabase();
  }, [meteredConfirmed]);

  const startBackgroundUpdate = async () => {
    if (!availableVersion || isDownloadingUpdate) return;

    try {
      setIsDownloadingUpdate(true);
      setDownloadProgress(null);

      await downloadUpdate(availableVersion, (progress) => {
        setDownloadProgress(progress);
      });

      setUpdateReady(true);
      setIsDownloadingUpdate(false);
      setDownloadProgress(null);
      console.log('✅ Update downloaded and cached');
    } catch (err) {
      console.error('Failed to download update:', err);
      setIsDownloadingUpdate(false);
      setDownloadProgress(null);
    }
  };

  const reloadWithNewVersion = () => {
    window.location.reload();
  };

  const clearCache = async () => {
    try {
      console.log('🗑️ Clearing database cache...');

      // Close sql.js database if open
      if (db) {
        try {
          db.close();
          console.log('✅ Closed sql.js database');
        } catch (err) {
          console.warn('Failed to close sql.js database:', err);
        }
      }

      // Set the database to null to release references
      setDb(null);

      // Wait a tick to ensure all references are released
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to clear IndexedDB cache (with timeout protection)
      try {
        await clearAllCache();
        console.log('✅ Cache cleared, reloading...');
      } catch (err) {
        console.warn('Failed to clear cache, but reloading anyway:', err);
      }

      // Force reload with cache bypass (hard reload)
      window.location.reload();
    } catch (err) {
      console.error('Unexpected error in clearCache:', err);
      // Even if everything fails, still reload - the app will try to recover
      console.log('⚠️ Reloading anyway to attempt recovery...');
      window.location.reload();
    }
  };

  const handleMeteredConfirm = () => {
    localStorage.setItem(METERED_WARNING_KEY, 'accepted');
    setShowMeteredWarning(false);
    setMeteredConfirmed(true); // Trigger database load
  };

  const handleMeteredCancel = () => {
    setShowMeteredWarning(false);
    setIsLoading(false);
    setError(new Error('Database download cancelled. Please connect to WiFi and refresh the page.'));
  };

  const isUpdateAvailable = !!(availableVersion && availableVersion !== currentVersion);

  return (
    <DatabaseContext.Provider
      value={{
        db,
        isLoading,
        error,
        downloadProgress,
        currentVersion,
        availableVersion,
        isUpdateAvailable,
        isDownloadingUpdate,
        updateReady,
        startBackgroundUpdate,
        reloadWithNewVersion,
        clearDatabaseCache: clearCache,
      }}
    >
      {children}
      {showMeteredWarning && (
        <MeteredConnectionWarning
          onConfirm={handleMeteredConfirm}
          onCancel={handleMeteredCancel}
          databaseSizeMB={DATABASE_SIZE_MB}
        />
      )}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
