type FetchImpl = typeof fetch

export interface VersionMetadata {
  version: string | null
  buildTime: string | null
}

export interface VersionCheckResult extends VersionMetadata {
  hasUpdate: boolean
  error?: Error
}

export interface CheckForUpdateOptions {
  currentVersion?: string
  versionUrl?: string
  fetchImpl?: FetchImpl
  signal?: AbortSignal
}

export interface VersionPollingOptions {
  intervalMs?: number
  versionUrl?: string
  fetchImpl?: FetchImpl
  currentVersion?: string
  documentRef?: Document
  runImmediately?: boolean
}

export interface VersionPollingHandle {
  stop: () => void
}

const DEFAULT_VERSION_URL = '/version.json'
const DEFAULT_DEV_INTERVAL_MS = 5_000
const FALLBACK_INTERVAL_MS = 600_000 // 10 minutes
const CURRENT_VERSION = typeof import.meta !== 'undefined' ? (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'unknown' : 'unknown'

function getIntervalMs(intervalOverride?: number): number {
  if (typeof intervalOverride === 'number' && Number.isFinite(intervalOverride) && intervalOverride > 0) {
    return intervalOverride
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return DEFAULT_DEV_INTERVAL_MS
  }

  const envValue = typeof import.meta !== 'undefined' ? (import.meta.env.VITE_VERSION_CHECK_INTERVAL_MS as string | undefined) : undefined
  const parsed = envValue ? Number(envValue) : Number.NaN

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  return FALLBACK_INTERVAL_MS
}

export async function checkForUpdate(options: CheckForUpdateOptions = {}): Promise<VersionCheckResult> {
  const {
    currentVersion = CURRENT_VERSION,
    versionUrl = DEFAULT_VERSION_URL,
    fetchImpl = fetch,
    signal,
  } = options

  try {
    const response = await fetchImpl(versionUrl, {
      cache: 'no-cache',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      },
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch version metadata (status ${response.status})`)
    }

    const data = await response.json() as Partial<VersionMetadata>
    const latestVersion = typeof data.version === 'string' ? data.version : null
    const buildTime = typeof data.buildTime === 'string' ? data.buildTime : null

    return {
      version: latestVersion,
      buildTime,
      hasUpdate: Boolean(latestVersion && latestVersion !== currentVersion),
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return {
      version: null,
      buildTime: null,
      hasUpdate: false,
      error: err,
    }
  }
}

export function startVersionPolling(
  onUpdateDetected: (result: VersionCheckResult) => void,
  options: VersionPollingOptions = {}
): VersionPollingHandle {
  const {
    intervalMs,
    versionUrl,
    fetchImpl,
    currentVersion = CURRENT_VERSION,
    documentRef = typeof document !== 'undefined' ? document : undefined,
    runImmediately = true,
  } = options

  let stopped = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let abortController: AbortController | undefined
  let latestKnownVersion: string | null = null
  let inFlight = false

  const effectiveInterval = getIntervalMs(intervalMs)

  const clearTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }

  const scheduleNext = () => {
    if (stopped) return
    clearTimer()
    timeoutId = setTimeout(runCheck, effectiveInterval)
  }

  const runCheck = async () => {
    if (stopped || inFlight) {
      return
    }

    if (documentRef && documentRef.visibilityState === 'hidden') {
      scheduleNext()
      return
    }

    inFlight = true
    abortController = new AbortController()

    const result = await checkForUpdate({
      currentVersion: latestKnownVersion ?? currentVersion,
      versionUrl,
      fetchImpl,
      signal: abortController.signal,
    })

    inFlight = false
    abortController = undefined

    if (result.version) {
      latestKnownVersion = result.version
    }

    if (!stopped && result.hasUpdate) {
      onUpdateDetected(result)
    }

    scheduleNext()
  }

  const handleVisibilityChange = () => {
    if (stopped) return
    if (!documentRef) return

    if (documentRef.visibilityState === 'visible') {
      void runCheck()
    } else if (abortController) {
      abortController.abort()
    }
  }

  if (documentRef) {
    documentRef.addEventListener('visibilitychange', handleVisibilityChange)
  }

  if (runImmediately) {
    void runCheck()
  } else {
    scheduleNext()
  }

  return {
    stop: () => {
      if (stopped) return
      stopped = true
      clearTimer()
      if (abortController) {
        abortController.abort()
        abortController = undefined
      }
      if (documentRef) {
        documentRef.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    },
  }
}
