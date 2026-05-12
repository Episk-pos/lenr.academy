import { describe, it, expect } from 'vitest'
import {
  parseVersion,
  formatBuildTime,
  getVersionTooltip,
  getGitHubReleaseUrl,
} from './version'

describe('parseVersion', () => {
  it('parses exact release tag', () => {
    const info = parseVersion('v0.1.0-alpha.0')
    expect(info.version).toBe('v0.1.0-alpha.0')
    expect(info.isRelease).toBe(true)
    expect(info.displayVersion).toBe('v0.1.0-alpha.0')
  })

  it('parses release tag with dirty flag', () => {
    const info = parseVersion('v0.1.0-alpha.0-dirty')
    expect(info.version).toBe('v0.1.0-alpha.0')
    expect(info.isRelease).toBe(false)
    expect(info.displayVersion).toBe('v0.1.0-alpha.0 (modified)')
  })

  it('parses version with commits ahead', () => {
    const info = parseVersion('v0.1.0-alpha.0-4-g72f289d')
    expect(info.version).toBe('v0.1.0-alpha.0')
    expect(info.isRelease).toBe(false)
    expect(info.displayVersion).toBe('v0.1.0-alpha.0+4.72f289d')
    expect(info.fullVersion).toBe('v0.1.0-alpha.0-4-g72f289d')
  })

  it('parses version with commits ahead and dirty flag', () => {
    const info = parseVersion('v0.1.0-alpha.0-4-g72f289d-dirty')
    expect(info.version).toBe('v0.1.0-alpha.0')
    expect(info.isRelease).toBe(false)
    expect(info.displayVersion).toBe('v0.1.0-alpha.0+4.72f289d.dirty')
  })

  it('parses simple semver tag', () => {
    const info = parseVersion('v1.2.3')
    expect(info.version).toBe('v1.2.3')
    expect(info.isRelease).toBe(true)
  })

  it('handles unknown format as fallback', () => {
    const info = parseVersion('unknown')
    expect(info.version).toBe('unknown')
    expect(info.isRelease).toBe(false)
    expect(info.displayVersion).toBe('unknown')
  })

  it('includes buildTime from env', () => {
    const info = parseVersion('v1.0.0')
    expect(info.buildTime).toBeDefined()
    expect(typeof info.buildTime).toBe('string')
  })
})

describe('formatBuildTime', () => {
  it('formats ISO date string for display', () => {
    const result = formatBuildTime('2026-01-15T10:30:00Z')
    // Should produce a non-empty string that differs from the raw input
    expect(result).toBeTruthy()
    expect(result).not.toBe('2026-01-15T10:30:00Z')
  })

  it('returns a string for invalid date input', () => {
    const result = formatBuildTime('not-a-date')
    // Should return either 'Invalid Date' or the original input string
    expect(result === 'Invalid Date' || result === 'not-a-date').toBe(true)
  })
})

describe('getVersionTooltip', () => {
  it('includes version display for release', () => {
    const info = parseVersion('v1.0.0')
    const tooltip = getVersionTooltip(info)
    expect(tooltip).toContain('Version: v1.0.0')
    expect(tooltip).toContain('Click to view release on GitHub')
  })

  it('includes base version for non-release', () => {
    const info = parseVersion('v1.0.0-3-gabc1234')
    const tooltip = getVersionTooltip(info)
    expect(tooltip).toContain('Base: v1.0.0')
  })

  it('includes build time', () => {
    const info = parseVersion('v1.0.0')
    const tooltip = getVersionTooltip(info)
    expect(tooltip).toContain('Built:')
  })
})

describe('getGitHubReleaseUrl', () => {
  it('links to specific tag for releases', () => {
    const info = parseVersion('v1.0.0')
    const url = getGitHubReleaseUrl(info)
    expect(url).toBe('https://github.com/Episk-pos/lenr.academy/releases/tag/v1.0.0')
  })

  it('links to releases page for dev builds', () => {
    const info = parseVersion('v1.0.0-3-gabc1234')
    const url = getGitHubReleaseUrl(info)
    expect(url).toBe('https://github.com/Episk-pos/lenr.academy/releases')
  })
})
