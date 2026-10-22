import { describe, it, expect } from 'vitest'
import { WorkerCancelledError, isWorkerCancelled } from './workerCancellation'

describe('workerCancellation', () => {
  it('flags cancellation independently of the (translated) message', () => {
    const err = new WorkerCancelledError('Simulation vom Benutzer abgebrochen')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('WorkerCancelledError')
    expect(err.cancelled).toBe(true)
    expect(isWorkerCancelled(err)).toBe(true)
  })

  it('does not treat ordinary errors as cancellation, even with the English text', () => {
    expect(isWorkerCancelled(new Error('Simulation cancelled by user'))).toBe(false)
    expect(isWorkerCancelled(new Error('Cycle discovery cancelled by user'))).toBe(false)
    expect(isWorkerCancelled('cancelled')).toBe(false)
    expect(isWorkerCancelled(null)).toBe(false)
  })

  it('accepts plain objects carrying the cancelled flag (e.g. across realms)', () => {
    expect(isWorkerCancelled({ cancelled: true, message: 'x' })).toBe(true)
  })
})
