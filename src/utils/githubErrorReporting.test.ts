import { describe, it, expect } from 'vitest'
import {
  getGitHubSearchUrl,
  getGitHubNewIssueUrl,
  formatErrorReportForClipboard,
} from './githubErrorReporting'
import type { ErrorContext } from './errorContext'

function makeErrorContext(overrides?: Partial<ErrorContext>): ErrorContext {
  return {
    error: new Error('Test error message'),
    errorBoundary: 'TestBoundary',
    timestamp: '2026-01-15T10:30:00.000Z',
    url: 'https://lenr.academy/fusion',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    browser: 'Chrome',
    browserVersion: '120.0.0',
    os: 'macOS',
    device: 'Desktop',
    appVersion: 'v0.1.0-alpha.21',
    fingerprint: 'abc123def456',
    stackTrace: '    at Component.render (app.tsx:42:10)\n    at renderWithHooks (react-dom.js:100)',
    ...overrides,
  }
}

describe('getGitHubSearchUrl', () => {
  it('generates a search URL with fingerprint and error message', () => {
    const ctx = makeErrorContext()
    const url = getGitHubSearchUrl(ctx)

    expect(url).toContain('https://github.com/Episk-pos/lenr.academy/issues')
    expect(url).toContain('fingerprint%3Aabc123def456')
    expect(url).toContain('Test%20error%20message')
    expect(url).toContain('label%3Abug')
  })

  it('truncates long error messages to 60 characters', () => {
    const longMessage = 'A'.repeat(100)
    const ctx = makeErrorContext({ error: new Error(longMessage) })
    const url = getGitHubSearchUrl(ctx)

    // The search term should be truncated
    const decoded = decodeURIComponent(url)
    expect(decoded).toContain('A'.repeat(60))
    expect(decoded).not.toContain('A'.repeat(100))
  })
})

describe('getGitHubNewIssueUrl', () => {
  it('generates a new issue URL with template and labels', () => {
    const ctx = makeErrorContext()
    const url = getGitHubNewIssueUrl(ctx)

    expect(url).toContain('https://github.com/Episk-pos/lenr.academy/issues/new')
    expect(url).toContain('template=error_report.yml')
    expect(url).toContain('labels=bug')
    expect(url).toContain('needs-triage')
    expect(url).toContain('automated-report')
  })

  it('includes fingerprint in title', () => {
    const ctx = makeErrorContext()
    const url = getGitHubNewIssueUrl(ctx)

    expect(url).toContain('fp%3Aabc123def456')
  })

  it('truncates long error messages in title to 80 characters', () => {
    const longMessage = 'B'.repeat(200)
    const ctx = makeErrorContext({ error: new Error(longMessage) })
    const url = getGitHubNewIssueUrl(ctx)

    const decoded = decodeURIComponent(url)
    // Title should be truncated — the message portion should be 80 chars max
    expect(decoded).toContain('B'.repeat(80))
    expect(decoded).not.toContain('B'.repeat(81))
  })
})

describe('formatErrorReportForClipboard', () => {
  it('includes error fingerprint', () => {
    const ctx = makeErrorContext()
    const report = formatErrorReportForClipboard(ctx)

    expect(report).toContain('abc123def456')
  })

  it('includes error type and message', () => {
    const ctx = makeErrorContext()
    const report = formatErrorReportForClipboard(ctx)

    expect(report).toContain('**Error Type:** Error')
    expect(report).toContain('Test error message')
  })

  it('includes stack trace', () => {
    const ctx = makeErrorContext()
    const report = formatErrorReportForClipboard(ctx)

    expect(report).toContain('at Component.render')
  })

  it('includes environment section', () => {
    const ctx = makeErrorContext()
    const report = formatErrorReportForClipboard(ctx)

    expect(report).toContain('**Browser:** Chrome 120.0.0')
    expect(report).toContain('**OS:** macOS')
    expect(report).toContain('**Device:** Desktop')
    expect(report).toContain('**App Version:** v0.1.0-alpha.21')
    expect(report).toContain('**URL:** https://lenr.academy/fusion')
  })

  it('includes steps to reproduce placeholder', () => {
    const ctx = makeErrorContext()
    const report = formatErrorReportForClipboard(ctx)

    expect(report).toContain('### Steps to Reproduce')
  })

  it('includes expected and actual behavior sections', () => {
    const ctx = makeErrorContext()
    const report = formatErrorReportForClipboard(ctx)

    expect(report).toContain('### Expected Behavior')
    expect(report).toContain('### Actual Behavior')
  })

  it('includes LENR Academy attribution', () => {
    const ctx = makeErrorContext()
    const report = formatErrorReportForClipboard(ctx)

    expect(report).toContain("LENR Academy's error reporting system")
  })
})
