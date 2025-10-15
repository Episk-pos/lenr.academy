interface FetchOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

export interface ReleaseNotes {
  tagName: string
  name: string
  body: string
  publishedAt: string | null
  htmlUrl: string
}

const REPO_OWNER = 'Episk-pos'
const REPO_NAME = 'lenr.academy'
const API_BASE_URL = 'https://api.github.com'

const cache = new Map<string, ReleaseNotes>()

class ReleaseNotFoundError extends Error {
  constructor(tagName: string) {
    super(`Release not found for tag "${tagName}"`)
    this.name = 'ReleaseNotFoundError'
  }
}

function normalizeTag(tag: string): string {
  if (!tag) return tag
  return tag.startsWith('v') ? tag : `v${tag}`
}

async function request<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { signal, fetchImpl = fetch } = options
  const response = await fetchImpl(url, {
    signal,
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    const message = errorText || response.statusText || 'Unknown error'
    const error = new Error(message)
    ;(error as any).status = response.status
    throw error
  }

  return await response.json() as T
}

function mapRelease(data: any): ReleaseNotes {
  return {
    tagName: data.tag_name ?? 'unknown',
    name: data.name ?? data.tag_name ?? 'Release',
    body: data.body ?? '',
    publishedAt: data.published_at ?? null,
    htmlUrl: data.html_url ?? `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
  }
}

export async function fetchReleaseNotes(tag: string, options: FetchOptions = {}): Promise<ReleaseNotes> {
  const normalized = normalizeTag(tag)

  if (cache.has(normalized)) {
    return cache.get(normalized)!
  }

  const releaseUrl = `${API_BASE_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${encodeURIComponent(normalized)}`

  try {
    const release = await request<any>(releaseUrl, options)
    const mapped = mapRelease(release)
    cache.set(normalized, mapped)
    return mapped
  } catch (error) {
    const status = (error as any).status

    if (status === 404) {
      try {
        const releasesUrl = `${API_BASE_URL}/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`
        const releases = await request<any[]>(releasesUrl, options)
        const match = releases.find((release) => normalizeTag(release.tag_name) === normalized)
        if (!match) {
          throw new ReleaseNotFoundError(normalized)
        }
        const mapped = mapRelease(match)
        cache.set(normalized, mapped)
        return mapped
      } catch (innerError) {
        if (innerError instanceof ReleaseNotFoundError) {
          throw innerError
        }
        throw innerError
      }
    }

    throw error
  }
}

export function clearReleaseNotesCache() {
  cache.clear()
}
