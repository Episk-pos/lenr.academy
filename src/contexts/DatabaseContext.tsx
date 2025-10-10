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
    console.log('📡 Network connection info:', {
      type: conn.type,
      effectiveType: conn.effectiveType,
      saveData: conn.saveData,
      downlink: conn.downlink,
      rtt: conn.rtt
    });

    // Check if user has enabled data saver
    if (conn.saveData === true) {
      console.log('⚠️ Data saver detected');
      return true;
    }

    // Check connection type - cellular connections are typically metered
    const meteredTypes = ['cellular', '2g', '3g', '4g', '5g'];
    if (conn.effectiveType && meteredTypes.includes(conn.effectiveType)) {
      console.log('⚠️ Cellular connection detected:', conn.effectiveType);
      return true;
    }

    if (conn.type && meteredTypes.includes(conn.type)) {
      console.log('⚠️ Metered connection type detected:', conn.type);
      return true;
    }

    // Check if connection is explicitly marked as metered (rarely supported)
    if (typeof conn.metered === 'boolean' && conn.metered) {
      console.log('⚠️ Connection explicitly marked as metered');
      return true;
    }
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
      await clearAllCache();
      console.log('✅ Cache cleared, reloading...');
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      throw err;
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
