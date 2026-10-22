import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  return (
    <div className="card p-6 bg-blue-50 dark:bg-blue-900/20">
      <div className="flex items-start gap-4">
        <Loader2 className="w-6 h-6 text-blue-600 flex-shrink-0 animate-spin mt-1" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              {t('cascades.runningSimulation')}
            </h3>
            <button
              onClick={onCancel}
              className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title={t('cascades.cancelSimulation')}
            >
              <XCircle className="w-4 h-4" />
              <span>{t('common.cancel')}</span>
            </button>
          </div>

          {/* Progress Info */}
          <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">{t('cascades.loopProgress')}</span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {progress.loop + 1} / {progress.totalLoops}
              </p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">
                {progress.newReactionsCount < 0 ? t('cascades.status') : t('cascades.newReactionsThisLoop')}
              </span>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {progress.newReactionsCount === -1 && t('cascades.finalizing')}
                {progress.newReactionsCount === -2 && t('cascades.calculatingEnergy')}
                {progress.newReactionsCount === -3 && t('cascades.preparingResults')}
                {progress.newReactionsCount >= 0 && progress.newReactionsCount}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute top-0 start-0 h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }}
            />
          </div>
          <div className="mt-1 text-end text-xs text-gray-600 dark:text-gray-400">
            {t('cascades.percentComplete', { percent: progress.percentage.toFixed(0) })}
          </div>

          {/* Info Text */}
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            {progress.newReactionsCount === -1 && t('cascades.finalizingDescription')}
            {progress.newReactionsCount === -2 && t('cascades.calculatingEnergyDescription')}
            {progress.newReactionsCount === -3 && t('cascades.preparingResultsDescription')}
            {progress.newReactionsCount >= 0 && t('cascades.searchingReactions')}
          </p>
        </div>
      </div>
    </div>
  );
}
