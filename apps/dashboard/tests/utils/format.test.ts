import { describe, expect, it } from 'vitest'
import { fmtNum, fmtPct } from '../../app/utils/format'

describe('fmtNum', () => {
  it('formats a number with French locale', () => {
    expect(fmtNum(1284)).toContain('1')
    expect(fmtNum(1284)).toContain('284')
  })

  it('returns fallback for null', () => {
    expect(fmtNum(null)).toBe('--')
  })

  it('returns fallback for undefined', () => {
    expect(fmtNum(undefined)).toBe('--')
  })

  it('accepts a custom fallback', () => {
    expect(fmtNum(null, 'N/A')).toBe('N/A')
  })

  it('formats zero', () => {
    expect(fmtNum(0)).toBe('0')
  })
})

describe('fmtPct', () => {
  it('rounds to integer', () => {
    expect(fmtPct(61.7)).toBe('62')
  })

  it('returns fallback for null', () => {
    expect(fmtPct(null)).toBe('--')
  })

  it('returns fallback for undefined', () => {
    expect(fmtPct(undefined)).toBe('--')
  })

  it('handles zero', () => {
    expect(fmtPct(0)).toBe('0')
  })

  it('handles 100', () => {
    expect(fmtPct(100)).toBe('100')
  })
})
