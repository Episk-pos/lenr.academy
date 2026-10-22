import { useCallback, useEffect, useState } from 'react'

/**
 * Sequences the first-visit prompts so they never compete:
 * the language selection modal comes first, and the privacy/analytics
 * banner is deferred until the language has been chosen, the modal has been
 * dismissed, or the language was already selected on a previous visit.
 */
export function useFirstVisitPrompts(isFirstVisit: boolean) {
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(isFirstVisit)
  // True once the user has confirmed or dismissed the modal this session
  const [languagePromptResolved, setLanguagePromptResolved] = useState(false)

  // Open the modal if first-visit status arrives after mount.
  useEffect(() => {
    if (isFirstVisit && !languagePromptResolved) {
      setIsLanguageModalOpen(true)
    }
    // Only react to first-visit changes; closing the modal must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstVisit])

  const closeLanguageModal = useCallback(() => {
    setIsLanguageModalOpen(false)
    setLanguagePromptResolved(true)
  }, [])

  const privacyBannerDeferred = isLanguageModalOpen || (isFirstVisit && !languagePromptResolved)

  return { isLanguageModalOpen, closeLanguageModal, privacyBannerDeferred }
}
