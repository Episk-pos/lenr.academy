import { useState, useEffect } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Copy, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { collectErrorContext, type ErrorContext } from '../utils/errorContext';
import {
  getGitHubSearchUrl,
  getGitHubNewIssueUrl,
  copyErrorReportToClipboard,
} from '../utils/githubErrorReporting';
import { clearAllCache } from '../services/dbCache';

interface ErrorDisplayProps {
  error: Error;
  resetError?: () => void;
  errorBoundary?: string;
  isDatabaseError?: boolean;
}

export default function ErrorDisplay({
  error,
  resetError,
  errorBoundary = 'App',
  isDatabaseError = false,
}: ErrorDisplayProps) {
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Collect error context on mount
  useEffect(() => {
    const context = collectErrorContext(error, errorBoundary);
    setErrorContext(context);
  }, [error, errorBoundary]);

  // Check if this is a database corruption error
  const isCorruptionError = isDatabaseError && error.message.toLowerCase().includes('file is not a database');

  const handleSearchSimilar = () => {
    if (!errorContext) return;

    const searchUrl = getGitHubSearchUrl(errorContext);
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
    setHasSearched(true);
  };

  const handleReportError = async () => {
    if (!errorContext) return;

    try {
      // Copy formatted error report to clipboard
      await copyErrorReportToClipboard(errorContext);

      // Show success feedback with countdown
      setCopySuccess(true);
      setCountdown(3);

      // Countdown timer
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      // Open GitHub new issue page after 3 seconds
      setTimeout(() => {
        const newIssueUrl = getGitHubNewIssueUrl(errorContext);
        window.open(newIssueUrl, '_blank', 'noopener,noreferrer');
        setCopySuccess(false);
        setCountdown(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy error report:', err);
      // Still open GitHub even if clipboard fails (immediately, no countdown)
      const newIssueUrl = getGitHubNewIssueUrl(errorContext);
      window.open(newIssueUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const copyFingerprint = async () => {
    if (!errorContext) return;

    try {
      await navigator.clipboard.writeText(errorContext.fingerprint);
      // Could add visual feedback here if desired
    } catch (err) {
      console.error('Failed to copy fingerprint:', err);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('This will clear the cached database and reload the page. The database (161MB) will be re-downloaded. Continue?')) {
      return;
    }

    setIsClearing(true);
    try {
      console.log('🗑️ ErrorDisplay: Starting cache clear...');
      await clearAllCache();
      console.log('✅ ErrorDisplay: Cache cleared, reloading...');
      window.location.reload();
    } catch (err) {
      console.error('❌ ErrorDisplay: Failed to clear cache:', err);
      // Reload anyway to attempt recovery
      console.log('⚠️ ErrorDisplay: Reloading anyway...');
      window.location.reload();
    }
  };

  const formatStackTrace = (stackTrace: string): JSX.Element[] => {
    const lines = stackTrace.split('\n');
    return lines.map((line, index) => {
      // Match file paths with line:column (e.g., "at Component.tsx:123:45")
      const filePathMatch = /at (.+\.(?:tsx?|jsx?|js)):(\d+):(\d+)/.exec(line);

      if (filePathMatch) {
        const [fullMatch, filePath, lineNum, colNum] = filePathMatch;
        const beforePath = line.substring(0, line.indexOf(fullMatch) + 3); // "at "
        const afterLocation = line.substring(line.indexOf(fullMatch) + fullMatch.length);

        return (
          <span key={index} className="error-stack-line">
            {beforePath}
            <span className="error-stack-file">{filePath}</span>
            <span className="error-stack-location">:{lineNum}:{colNum}</span>
            {afterLocation}
          </span>
        );
      }

      return (
        <span key={index} className="error-stack-line">
          {line}
        </span>
      );
    });
  };

  if (!errorContext) {
    return null; // Wait for context to be collected
  }

  return (
    <div className="card p-6 bg-red-50 dark:bg-red-900/20 max-w-4xl">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          {/* Error Title */}
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
            {isDatabaseError ? 'Database Error' : 'Something went wrong'}
          </h3>

          {/* Error Message */}
          <p className="text-red-700 dark:text-red-300 mb-3 break-words">
            {error.message}
          </p>

          {/* Sentry Notice */}
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            This error has been automatically reported to our team.
          </p>

          {/* Technical Details Section */}
          <div className="mb-4">
            <button
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {isDetailsExpanded ? (
                <ChevronDown className="w-4 h-4 transition-transform" />
              ) : (
                <ChevronRight className="w-4 h-4 transition-transform" />
              )}
              Technical Details
            </button>

            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isDetailsExpanded ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="space-y-3">
                {/* Error Fingerprint */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Error Fingerprint:</span>
                  <button
                    onClick={copyFingerprint}
                    className="error-fingerprint inline-flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    title="Click to copy"
                  >
                    {errorContext.fingerprint}
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Timestamp:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {new Date(errorContext.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Browser:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {errorContext.browser} {errorContext.browserVersion}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">OS:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {errorContext.os}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Device:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {errorContext.device}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">URL:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100 break-all">
                      {errorContext.url}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">App Version:</span>
                    <span className="ml-2 text-gray-900 dark:text-gray-100">
                      {errorContext.appVersion}
                    </span>
                  </div>
                </div>

                {/* Stack Trace */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stack Trace:
                  </h4>
                  <div className="error-stack">
                    {formatStackTrace(errorContext.stackTrace)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Database Corruption Recovery Section */}
          {isCorruptionError && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/40 rounded-md border border-red-200 dark:border-red-800">
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
                Note: This will re-download the 161MB database file
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mt-4">
            {/* GitHub Integration Buttons */}
            <button
              onClick={handleSearchSimilar}
              className="btn btn-secondary px-4 py-2 text-sm flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search Similar Issues
              <ExternalLink className="w-3 h-3" />
            </button>

            <button
              onClick={handleReportError}
              disabled={!hasSearched || countdown !== null}
              className="btn btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed relative"
              title={
                !hasSearched
                  ? 'Please search for similar issues first to avoid duplicate reports'
                  : countdown !== null
                  ? 'Copying to clipboard and opening GitHub...'
                  : 'Copy error details and open GitHub to report'
              }
            >
              <ExternalLink className="w-4 h-4" />
              {countdown !== null
                ? `Opening in ${countdown}s...`
                : copySuccess
                ? 'Copied!'
                : 'Report This Error'}
            </button>

            {/* Toast notification */}
            {copySuccess && countdown !== null && (
              <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg max-w-md animate-slide-in">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">Error report copied to clipboard!</p>
                    <p className="text-sm text-green-100 mt-1">Opening GitHub in {countdown}s... Please fill in the reproduction steps after pasting.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Standard Recovery Buttons */}
            {resetError && (
              <button
                onClick={resetError}
                className="btn btn-secondary px-4 py-2 text-sm"
              >
                Try Again
              </button>
            )}

            <button
              onClick={() => window.location.href = '/'}
              className="btn btn-secondary px-4 py-2 text-sm"
            >
              Return to Home
            </button>
          </div>

          {/* Helper text for Report button */}
          {!hasSearched ? (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              💡 Please search for similar issues <strong>first</strong> to avoid duplicate reports
            </p>
          ) : (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              📝 <strong>Important:</strong> After pasting the error report, please fill in the Steps to Reproduce, Expected Behavior, and Actual Behavior sections to help us fix this issue quickly
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
