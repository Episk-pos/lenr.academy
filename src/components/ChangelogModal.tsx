import { useEffect, useRef, useState } from 'react'
import { X, Sparkles, RotateCcw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkGithub from 'remark-github'
import type { Components } from 'react-markdown'
import type { ReleaseNotes } from '../services/changelog'

interface ChangelogModalProps {
  isOpen: boolean
  onClose: () => void
  releaseNotes: ReleaseNotes | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  versionLabel: string
}

const EXIT_ANIMATION_MS = 200

export default function ChangelogModal({
  isOpen,
  onClose,
  releaseNotes,
  isLoading,
  error,
  onRetry,
  versionLabel,
}: ChangelogModalProps) {
  const [isRendered, setIsRendered] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      setIsRendered(true)
      requestAnimationFrame(() => setIsActive(true))
    } else if (isRendered) {
      setIsActive(false)
      exitTimerRef.current = setTimeout(() => {
        setIsRendered(false)
        exitTimerRef.current = null
      }, EXIT_ANIMATION_MS)
    }
  }, [isOpen, isRendered])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [])

  if (!isRendered) {
    return null
  }

  const markdownComponents: Components = {
    a: ({ node, ...props }) => (
      <a
        {...props}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-yellow-700 dark:text-yellow-300 hover:underline"
      />
    ),
    ul: ({ node, ...props }) => (
      <ul {...props} className="list-disc pl-5 space-y-1" />
    ),
    ol: ({ node, ...props }) => (
      <ol {...props} className="list-decimal pl-5 space-y-1" />
    ),
  }

  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 transition-opacity duration-200 ${
      isActive ? 'bg-black/50 opacity-100' : 'bg-black/20 opacity-0 pointer-events-none'
    }`}>
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[90vh] flex flex-col transform transition-transform duration-200 ${
          isActive ? 'translate-y-0 scale-100' : 'translate-y-4 scale-[0.98]'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        data-testid="changelog-modal"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 p-2 rounded-full">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="changelog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                What&apos;s New in {versionLabel}
              </h2>
              {releaseNotes?.publishedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Published {new Date(releaseNotes.publishedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            aria-label="Close changelog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-sm text-gray-600 dark:text-gray-300 min-h-[200px] gap-2">
              <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>Loading release notes…</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex flex-col items-center justify-center text-center text-sm text-red-600 dark:text-red-400 gap-4 min-h-[200px]">
              <p>{error}</p>
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          )}

          {!isLoading && !error && releaseNotes && (
            <div className="space-y-4">
              {releaseNotes.name && releaseNotes.name !== releaseNotes.tagName && (
                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {releaseNotes.name}
                </p>
              )}
              <ReactMarkdown
                className="prose prose-sm max-w-none text-gray-700 dark:text-gray-200 dark:prose-invert prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-strong:text-gray-900 dark:prose-strong:text-gray-100"
                remarkPlugins={[remarkGfm, [remarkGithub, { repository: 'Episk-pos/lenr.academy' }]]}
                skipHtml
                components={markdownComponents}
              >
                {releaseNotes.body || 'No changelog details provided for this release.'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          {releaseNotes?.htmlUrl ? (
            <a
              href={releaseNotes.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:underline"
            >
              View full release on GitHub
            </a>
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Release published on GitHub Releases
            </span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
