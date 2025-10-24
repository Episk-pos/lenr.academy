import { Loader2, XCircle } from 'lucide-react';
import type { CascadeProgress } from '../hooks/useCascadeWorker';

interface CascadeProgressCardProps {
  progress: CascadeProgress;
  onCancel: () => void;
}

/**
 * Progress card displayed during cascade simulation
 *
 * Shows real-time progress with loop count, percentage, and cancel button
 */
export default function CascadeProgressCard({ progress, onCancel }: CascadeProgressCardProps) {
  return (
    <div className="card p-6 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-start gap-4">
        <Loader2 className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin mt-1" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              Running Cascade Simulation...
            </h3>
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Cancel simulation"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>

          {/* Progress Info */}
          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Loop Progress</span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {progress.loop + 1} / {progress.totalLoops}
              </p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">
                {progress.newReactionsCount < 0 ? 'Status' : 'New Reactions (this loop)'}
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {progress.newReactionsCount === -1 && 'Finalizing...'}
                {progress.newReactionsCount === -2 && 'Calculating energy...'}
                {progress.newReactionsCount === -3 && 'Preparing results...'}
                {progress.newReactionsCount >= 0 && progress.newReactionsCount}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-gray-600 dark:text-gray-400">
            {progress.percentage.toFixed(0)}% complete
          </div>

          {/* Info Text */}
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            {progress.newReactionsCount === -1 && 'Starting finalization process...'}
            {progress.newReactionsCount === -2 && 'Computing total energy from all reactions...'}
            {progress.newReactionsCount === -3 && 'Serializing results for display...'}
            {progress.newReactionsCount >= 0 && 'Searching for reactions between active nuclides and products...'}
          </p>
        </div>
      </div>
    </div>
  );
}
