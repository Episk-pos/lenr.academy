import { useState } from 'react';
import { History, Star, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SavedQuery, QueryFilter } from '../types';

interface QueryHistoryPanelProps {
  history: SavedQuery[];
  currentQueryType: 'fusion' | 'fission' | 'twotwo';
  onLoadQuery: (filter: QueryFilter, queryType: 'fusion' | 'fission' | 'twotwo') => void;
  onToggleBookmark: (id: string) => void;
  onRemove: (id: string) => void;
  onClearHistory: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatFilter(filter: QueryFilter): string {
  const parts: string[] = [];
  if (filter.element1List?.length) parts.push(`E1: ${filter.element1List.join(', ')}`);
  if (filter.element2List?.length) parts.push(`E2: ${filter.element2List.join(', ')}`);
  if (filter.elements?.length) parts.push(`E: ${filter.elements.join(', ')}`);
  if (filter.outputElementList?.length) parts.push(`Out: ${filter.outputElementList.join(', ')}`);
  if (filter.outputElement1List?.length) parts.push(`Out1: ${filter.outputElement1List.join(', ')}`);
  if (filter.outputElement2List?.length) parts.push(`Out2: ${filter.outputElement2List.join(', ')}`);
  if (filter.outputElement3List?.length) parts.push(`Out3: ${filter.outputElement3List.join(', ')}`);
  if (filter.outputElement4List?.length) parts.push(`Out4: ${filter.outputElement4List.join(', ')}`);
  if (filter.minMeV !== undefined) parts.push(`≥${filter.minMeV} MeV`);
  if (filter.maxMeV !== undefined) parts.push(`≤${filter.maxMeV} MeV`);
  if (filter.neutrinoType && filter.neutrinoType !== 'any') parts.push(`ν: ${filter.neutrinoType}`);
  if (filter.limit) parts.push(`limit: ${filter.limit}`);
  return parts.join(' · ') || 'No filters';
}

type FilterType = 'all' | 'fusion' | 'fission' | 'twotwo';

const TYPE_BADGE_STYLES: Record<'fusion' | 'fission' | 'twotwo', string> = {
  fusion: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  fission: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  twotwo: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

const TYPE_BADGE_LABELS: Record<'fusion' | 'fission' | 'twotwo', string> = {
  fusion: 'Fusion',
  fission: 'Fission',
  twotwo: '2\u21922',
};

export default function QueryHistoryPanel({
  history,
  currentQueryType: _,
  onLoadQuery,
  onToggleBookmark,
  onRemove,
  onClearHistory,
}: QueryHistoryPanelProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');

  const displayedHistory = filterType === 'all'
    ? history
    : history.filter(q => q.queryType === filterType);

  const bookmarked = displayedHistory.filter(q => q.isBookmarked);
  const recent = displayedHistory.filter(q => !q.isBookmarked);

  if (history.length === 0) return null;

  const filterOptions: { value: FilterType; labelKey: string }[] = [
    { value: 'all', labelKey: 'queryHistory.filterAll' },
    { value: 'fusion', labelKey: 'queryHistory.filterFusion' },
    { value: 'fission', labelKey: 'queryHistory.filterFission' },
    { value: 'twotwo', labelKey: 'queryHistory.filterTwoToTwo' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        title={t('queryHistory.title')}
      >
        <History className="w-4 h-4" />
        <span className="hidden sm:inline">{t('queryHistory.title')}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">({history.length})</span>
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {t('queryHistory.title')}
            </span>
            <div className="flex items-center gap-1">
              {recent.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 px-1.5 py-0.5"
                  title={t('queryHistory.clearHistory')}
                >
                  {t('queryHistory.clearHistory')}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter toggle pills */}
          <div className="sticky top-[41px] bg-white dark:bg-gray-800 px-3 py-2 flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {filterOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterType(opt.value)}
                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-colors ${
                  filterType === opt.value
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>

          {/* Bookmarked section */}
          {bookmarked.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                {t('queryHistory.bookmarked')}
              </div>
              {bookmarked.map(query => (
                <QueryHistoryItem
                  key={query.id}
                  query={query}
                  onLoad={onLoadQuery}
                  onToggleBookmark={onToggleBookmark}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}

          {/* Recent section */}
          {recent.length > 0 && (
            <div>
              {bookmarked.length > 0 && (
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                  {t('queryHistory.recent')}
                </div>
              )}
              {recent.map(query => (
                <QueryHistoryItem
                  key={query.id}
                  query={query}
                  onLoad={onLoadQuery}
                  onToggleBookmark={onToggleBookmark}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}

          {/* Empty state for filtered view */}
          {displayedHistory.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('queryHistory.noHistory')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueryHistoryItem({
  query,
  onLoad,
  onToggleBookmark,
  onRemove,
}: {
  query: SavedQuery;
  onLoad: (filter: QueryFilter, queryType: 'fusion' | 'fission' | 'twotwo') => void;
  onToggleBookmark: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onLoad(query.filter, query.queryType)}
          className="flex-1 text-left min-w-0"
        >
          <div className="text-sm font-medium text-gray-900 dark:text-white truncate flex items-center gap-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block flex-shrink-0 ${TYPE_BADGE_STYLES[query.queryType]}`}>
              {TYPE_BADGE_LABELS[query.queryType]}
            </span>
            <span className="truncate">{query.name}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {formatFilter(query.filter)}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatTimeAgo(query.timestamp)}
            </span>
            {query.resultCount !== undefined && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                · {query.resultCount} results
              </span>
            )}
          </div>
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(query.id); }}
            className={`p-1 rounded ${query.isBookmarked ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
            title={query.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Star className={`w-3.5 h-3.5 ${query.isBookmarked ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(query.id); }}
            className="p-1 rounded text-gray-400 hover:text-red-500"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
