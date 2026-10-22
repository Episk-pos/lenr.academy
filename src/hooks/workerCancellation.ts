/**
 * Error used to reject a worker run that the user cancelled.
 *
 * The message is translated for display, so callers must detect cancellation
 * with `isWorkerCancelled()` (a stable flag), never by comparing message text.
 */
export class WorkerCancelledError extends Error {
  readonly cancelled = true as const

  constructor(message: string) {
    super(message)
    this.name = 'WorkerCancelledError'
  }
}

/** True when `err` is a user cancellation of a worker run (locale-independent) */
export function isWorkerCancelled(err: unknown): boolean {
  return (
    err instanceof WorkerCancelledError ||
    (typeof err === 'object' && err !== null && (err as { cancelled?: unknown }).cancelled === true)
  )
}
