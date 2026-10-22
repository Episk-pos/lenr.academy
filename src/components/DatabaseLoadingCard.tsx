import { Loader } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DownloadProgress } from '../services/database'

interface DatabaseLoadingCardProps {
  downloadProgress: DownloadProgress | null
}

export default function DatabaseLoadingCard({ downloadProgress }: DatabaseLoadingCardProps) {
  const { t } = useTranslation()
  const formatBytes = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="card p-8 max-w-md w-full" data-testid="database-loading">
        <div className="flex flex-col items-center text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-500 mb-4" />

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {downloadProgress ? t('databaseLoading.downloadingTitle') : t('databaseLoading.loadingTitle')}
          </h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {downloadProgress
              ? t('databaseLoading.downloadingMessage')
              : t('databaseLoading.initializingMessage')}
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
                {t('databaseLoading.cachedNotice')}
              </p>
            </>
          )}

          {!downloadProgress && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {t('databaseLoading.pleaseWait')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
