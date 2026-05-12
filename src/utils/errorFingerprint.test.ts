import { describe, it, expect } from 'vitest'
import { generateErrorFingerprint, isValidFingerprint } from './errorFingerprint'

describe('generateErrorFingerprint', () => {
  it('returns an 8-character string', () => {
    const error = new Error('test error')
    const fp = generateErrorFingerprint(error)
    expect(fp).toHaveLength(8)
  })

  it('returns consistent fingerprints for the same error', () => {
    const error1 = new Error('test error')
    const error2 = new Error('test error')
    expect(generateErrorFingerprint(error1)).toBe(generateErrorFingerprint(error2))
  })

  it('returns different fingerprints for different messages', () => {
    const error1 = new Error('error one')
    const error2 = new Error('error two')
    expect(generateErrorFingerprint(error1)).not.toBe(generateErrorFingerprint(error2))
  })

  it('returns different fingerprints for different error types', () => {
    const error1 = new TypeError('cannot read')
    const error2 = new RangeError('cannot read')
    expect(generateErrorFingerprint(error1)).not.toBe(generateErrorFingerprint(error2))
  })

  it('normalizes whitespace in messages', () => {
    const error1 = new Error('test   error   message')
    const error2 = new Error('test error message')
    expect(generateErrorFingerprint(error1)).toBe(generateErrorFingerprint(error2))
  })

  it('is case-insensitive for messages', () => {
    const error1 = new Error('Test Error')
    const error2 = new Error('test error')
    expect(generateErrorFingerprint(error1)).toBe(generateErrorFingerprint(error2))
  })

  it('truncates long messages to 120 chars for consistency', () => {
    const longMsg = 'a'.repeat(200)
    const error1 = new Error(longMsg)
    const error2 = new Error(longMsg + ' extra text that differs')
    expect(generateErrorFingerprint(error1)).toBe(generateErrorFingerprint(error2))
  })

  it('produces valid fingerprints', () => {
    const error = new TypeError('Cannot read property "foo" of undefined')
    const fp = generateErrorFingerprint(error)
    expect(isValidFingerprint(fp)).toBe(true)
  })
})

describe('isValidFingerprint', () => {
  it('accepts 8-character lowercase alphanumeric strings', () => {
    expect(isValidFingerprint('a1b2c3d4')).toBe(true)
    expect(isValidFingerprint('00000000')).toBe(true)
    expect(isValidFingerprint('zzzzzzzz')).toBe(true)
  })

  it('rejects strings that are too short', () => {
    expect(isValidFingerprint('a1b2c3')).toBe(false)
  })

  it('rejects strings that are too long', () => {
    expect(isValidFingerprint('a1b2c3d4e5')).toBe(false)
  })

  it('rejects uppercase characters', () => {
    expect(isValidFingerprint('A1B2C3D4')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(isValidFingerprint('a1b2c3-4')).toBe(false)
  })

  it('rejects empty strings', () => {
    expect(isValidFingerprint('')).toBe(false)
  })
})
