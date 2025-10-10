import { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { clearAllCache } from '../services/dbCache';

interface DatabaseErrorCardProps {
  error: Error;
}

export default function DatabaseErrorCard({ error }: DatabaseErrorCardProps) {
  const [isClearing, setIsClearing] = useState(false);

  // Check if this is a database corruption error
  const isCorruptionError = error.message.toLowerCase().includes('file is not a database');

  const handleClearCache = async () => {
    if (!confirm('This will clear the cached database and reload the page. The database (154MB) will be re-downloaded. Continue?')) {
      return;
    }

    setIsClearing(true);
    try {
      console.log('🗑️ DatabaseErrorCard: Starting cache clear...');
      await clearAllCache();
      console.log('✅ DatabaseErrorCard: Cache cleared, reloading...');
      window.location.reload();
    } catch (err) {
      console.error('❌ DatabaseErrorCard: Failed to clear cache:', err);
      // Reload anyway to attempt recovery
      console.log('⚠️ DatabaseErrorCard: Reloading anyway...');
      window.location.reload();
    }
  };

  return (
    <div className="card p-6 bg-red-50 dark:bg-red-900/20">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-1">
            Database Error
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-3">{error.message}</p>

          {isCorruptionError && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/40 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                <strong>Database Corruption Detected</strong>
                <br />
                This error typically occurs when the cached database file is corrupted.
                You can fix this by clearing the cache and re-downloading the database.
              </p>
              <button
                onClick={handleClearCache}
                disabled={isClearing}
                className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isClearing ? 'animate-spin' : ''}`} />
                {isClearing ? 'Clearing Cache...' : 'Clear Cache & Reload'}
              </button>
              <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                Note: This will re-download the 154MB database file
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
