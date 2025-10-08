import { AlertTriangle, Wifi } from 'lucide-react'

interface MeteredConnectionWarningProps {
  onConfirm: () => void
  onCancel: () => void
  databaseSizeMB: number
}

export default function MeteredConnectionWarning({ onConfirm, onCancel, databaseSizeMB }: MeteredConnectionWarningProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="card p-6 max-w-md w-full border-2 border-orange-300 dark:border-orange-700" data-testid="metered-warning">
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Metered Connection Detected
            </h2>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">
              You appear to be on a cellular or metered connection. This application needs to download a <strong>{databaseSizeMB}MB database</strong> to function.
            </p>
            <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
              Downloading over a metered connection may use significant data and incur charges from your carrier.
            </p>
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Wifi className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-xs text-blue-800 dark:text-blue-300">
                We recommend connecting to WiFi before proceeding.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Wait for WiFi
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Download Anyway
          </button>
        </div>
      </div>
    </div>
  )
}
