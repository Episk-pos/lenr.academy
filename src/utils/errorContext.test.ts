import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectErrorContext } from './errorContext'

// Mock errorFingerprint
vi.mock('./errorFingerprint', () => ({
  generateErrorFingerprint: vi.fn().mockReturnValue('abc123'),
}))

describe('collectErrorContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('collects error information', () => {
    const error = new Error('Test error')
    const ctx = collectErrorContext(error, 'TestBoundary')

    expect(ctx.error).toBe(error)
    expect(ctx.errorBoundary).toBe('TestBoundary')
  })

  it('defaults errorBoundary to Unknown', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    expect(ctx.errorBoundary).toBe('Unknown')
  })

  it('captures timestamp as ISO string', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    expect(ctx.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('captures current URL', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    expect(ctx.url).toBe(window.location.href)
  })

  it('captures user agent', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    expect(ctx.userAgent).toBe(navigator.userAgent)
  })

  it('detects browser from user agent', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    // jsdom UA returns a fallback — verify it's a non-empty string
    expect(ctx.browser).toBeTruthy()
    expect(ctx.browser.length).toBeGreaterThan(0)
    expect(ctx.browserVersion).toBeTruthy()
  })

  it('detects OS from user agent', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    expect(ctx.os).toBeTruthy()
    expect(ctx.os.length).toBeGreaterThan(0)
  })

  it('detects device type', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    expect(['Desktop', 'Mobile', 'Tablet']).toContain(ctx.device)
  })

  it('includes fingerprint', () => {
    const error = new Error('Test')
    const ctx = collectErrorContext(error)

    expect(ctx.fingerprint).toBe('abc123')
  })

  it('formats stack trace without error message line', () => {
    const error = new Error('My error message')
    const ctx = collectErrorContext(error)

    // Stack trace should not start with the error message
    expect(ctx.stackTrace.startsWith('Error: My error message')).toBe(false)
    // Stack trace should be a non-empty string (containing actual frame info)
    expect(ctx.stackTrace.length).toBeGreaterThan(0)
  })

  it('handles error with no stack trace', () => {
    const error = new Error('No stack')
    error.stack = undefined

    const ctx = collectErrorContext(error)
    expect(ctx.stackTrace).toBe('No stack trace available')
  })
})
