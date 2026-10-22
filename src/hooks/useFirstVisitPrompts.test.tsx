import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import { mockReactI18next } from '../test-utils/i18nMock'

vi.mock('react-i18next', () => mockReactI18next)
vi.mock('../utils/analytics', () => ({
  loadUmamiScript: vi.fn().mockResolvedValue(undefined),
}))

import PrivacyBanner from '../components/PrivacyBanner'
import { useFirstVisitPrompts } from './useFirstVisitPrompts'

const ANALYTICS_CONSENT_KEY = 'lenr-analytics-consent'

/** Minimal stand-in for Layout's wiring: language modal + deferred privacy banner. */
function Harness({ isFirstVisit }: { isFirstVisit: boolean }) {
  const { isLanguageModalOpen, closeLanguageModal, privacyBannerDeferred } = useFirstVisitPrompts(isFirstVisit)
  return (
    <>
      {isLanguageModalOpen && (
        <div data-testid="language-selection-modal">
          <button onClick={closeLanguageModal}>dismiss-language</button>
        </div>
      )}
      <PrivacyBanner deferred={privacyBannerDeferred} />
    </>
  )
}

describe('useFirstVisitPrompts', () => {
  it('opens the language modal and defers the privacy banner on first visit', () => {
    const { result } = renderHook(() => useFirstVisitPrompts(true))
    expect(result.current.isLanguageModalOpen).toBe(true)
    expect(result.current.privacyBannerDeferred).toBe(true)

    act(() => result.current.closeLanguageModal())
    expect(result.current.isLanguageModalOpen).toBe(false)
    expect(result.current.privacyBannerDeferred).toBe(false)
  })

  it('does not open the modal or defer the banner when language was already selected', () => {
    const { result } = renderHook(() => useFirstVisitPrompts(false))
    expect(result.current.isLanguageModalOpen).toBe(false)
    expect(result.current.privacyBannerDeferred).toBe(false)
  })

  it('opens the modal if first-visit status arrives after mount', () => {
    const { result, rerender } = renderHook(({ first }) => useFirstVisitPrompts(first), {
      initialProps: { first: false },
    })
    rerender({ first: true })
    expect(result.current.isLanguageModalOpen).toBe(true)
    expect(result.current.privacyBannerDeferred).toBe(true)
  })

  it('stays resolved once the language is confirmed (first-visit flag clears)', () => {
    const { result, rerender } = renderHook(({ first }) => useFirstVisitPrompts(first), {
      initialProps: { first: true },
    })
    act(() => result.current.closeLanguageModal())
    rerender({ first: false })
    expect(result.current.isLanguageModalOpen).toBe(false)
    expect(result.current.privacyBannerDeferred).toBe(false)
  })
})

describe('first-visit prompt sequencing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the language modal first and the privacy banner only after it is dismissed', async () => {
    render(<Harness isFirstVisit />)
    await act(async () => { vi.advanceTimersByTime(16) })

    expect(screen.getByTestId('language-selection-modal')).toBeInTheDocument()
    expect(screen.queryByTestId('analytics-banner')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('dismiss-language'))
    })
    await act(async () => { vi.advanceTimersByTime(16) })

    expect(screen.queryByTestId('language-selection-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('analytics-banner')).toBeInTheDocument()
  })

  it('shows the privacy banner immediately when the language was already selected', async () => {
    render(<Harness isFirstVisit={false} />)
    await act(async () => { vi.advanceTimersByTime(16) })

    expect(screen.queryByTestId('language-selection-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('analytics-banner')).toBeInTheDocument()
  })

  it('shows neither prompt when both language and consent are already stored', async () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'accepted')
    render(<Harness isFirstVisit={false} />)
    await act(async () => { vi.advanceTimersByTime(16) })

    expect(screen.queryByTestId('language-selection-modal')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analytics-banner')).not.toBeInTheDocument()
  })
})
