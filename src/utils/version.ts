/**
 * Version utility functions for displaying application version information
 */

export interface VersionInfo {
  version: string
  isRelease: boolean
  displayVersion: string
  fullVersion: string
  buildTime: string
}

/**
 * Parse git describe output and format for display
 * Examples:
 *   v0.1.0-alpha.0              -> release version
 *   v0.1.0-alpha.0-4-g72f289d   -> 4 commits after release
 *   v0.1.0-alpha.0-dirty        -> uncommitted changes
 */
export function parseVersion(gitVersion: string): VersionInfo {
  const buildTime = import.meta.env.VITE_BUILD_TIME || new Date().toISOString()

  // Check if this is an exact tag (no additional commits)
  const exactTagMatch = /^(v[\d.]+(?:-[a-z]+\.\d+)?)(-dirty)?$/i.exec(gitVersion)

  if (exactTagMatch) {
    const [, version, dirty] = exactTagMatch
    const displayVersion = dirty ? `${version} (modified)` : version
    return {
      version,
      isRelease: !dirty,
      displayVersion,
      fullVersion: gitVersion,
      buildTime,
    }
  }

  // Parse version with commits ahead (e.g., v0.1.0-alpha.0-4-g72f289d-dirty)
  const fullMatch = /^(v[\d.]+(?:-[a-z]+\.\d+)?)-(\d+)-g([a-f0-9]+)(-dirty)?$/i.exec(gitVersion)

  if (fullMatch) {
    const [, baseVersion, commitsAhead, commitHash, dirty] = fullMatch
    const buildMetadata = `${commitsAhead}.${commitHash}${dirty ? '.dirty' : ''}`
    const displayVersion = `${baseVersion}+${buildMetadata}`

    return {
      version: baseVersion,
      isRelease: false,
      displayVersion,
      fullVersion: gitVersion,
      buildTime,
    }
  }

  // Fallback for unknown format
  return {
    version: gitVersion,
    isRelease: false,
    displayVersion: gitVersion,
    fullVersion: gitVersion,
    buildTime,
  }
}

/**
 * Get formatted version info for display
 */
export function getVersionInfo(): VersionInfo {
  const gitVersion = import.meta.env.VITE_APP_VERSION || 'unknown'
  return parseVersion(gitVersion)
}

/**
 * Format build time for display
 */
export function formatBuildTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

/**
 * Get tooltip text with full version details
 */
export function getVersionTooltip(versionInfo: VersionInfo): string {
  const parts = [
    `Version: ${versionInfo.displayVersion}`,
  ]

  if (!versionInfo.isRelease) {
    parts.push(`Base: ${versionInfo.version}`)
  }

  if (versionInfo.buildTime) {
    parts.push(`Built: ${formatBuildTime(versionInfo.buildTime)}`)
  }

  parts.push('Click to view release on GitHub')

  return parts.join('\n')
}

/**
 * Get GitHub release URL for the version
 */
export function getGitHubReleaseUrl(versionInfo: VersionInfo): string {
  const repoUrl = 'https://github.com/Episk-pos/lenr.academy'

  // For release versions, link to the tag
  if (versionInfo.isRelease) {
    return `${repoUrl}/releases/tag/${versionInfo.version}`
  }

  // For development builds, link to the releases page
  return `${repoUrl}/releases`
}
