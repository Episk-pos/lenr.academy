import { Loader } from 'lucide-react'
import type { DownloadProgress } from '../services/database'

interface DatabaseLoadingCardProps {
  downloadProgress: DownloadProgress | null
}

export default function DatabaseLoadingCard({ downloadProgress }: DatabaseLoadingCardProps) {
  const formatBytes = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="card p-8 max-w-md w-full" data-testid="database-loading">
        <div className="flex flex-col items-center text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-500 mb-4" />

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {downloadProgress ? 'Downloading Database' : 'Loading Database'}
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {downloadProgress
              ? 'Downloading Parkhomov nuclear reactions database...'
              : 'Initializing database engine...'}
          </p>

          {downloadProgress && downloadProgress.totalBytes > 0 && (
            <>
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, downloadProgress.percentage)}%` }}
                />
              </div>

              {/* Progress Stats */}
              <div className="w-full flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>{downloadProgress.percentage.toFixed(0)}%</span>
                <span>
                  {formatBytes(downloadProgress.downloadedBytes)} MB / {formatBytes(downloadProgress.totalBytes)} MB
                </span>
              </div>

              {/* Info */}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                This database will be cached for instant loading on future visits
              </p>
            </>
          )}

          {!downloadProgress && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Please wait a moment...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
