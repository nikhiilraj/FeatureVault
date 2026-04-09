import { describe, it, expect } from 'vitest'
import { isInRollout, assignVariant } from '../bucketing.js'

describe('isInRollout', () => {
  it('always returns false for 0%', () => {
    for (let i = 0; i < 100; i++) {
      expect(isInRollout(`user-${i}`, 'flag', 0)).toBe(false)
    }
  })

  it('always returns true for 100%', () => {
    for (let i = 0; i < 100; i++) {
      expect(isInRollout(`user-${i}`, 'flag', 100)).toBe(true)
    }
  })

  it('is deterministic — same user always gets same result', () => {
    const result1 = isInRollout('usr_123', 'dark-mode', 50)
    const result2 = isInRollout('usr_123', 'dark-mode', 50)
    const result3 = isInRollout('usr_123', 'dark-mode', 50)
    expect(result1).toBe(result2)
    expect(result2).toBe(result3)
  })

  it('distributes users within ±5% of expected percentage at 10% rollout', () => {
    const total  = 10_000
    const target = 10
    let count    = 0
    for (let i = 0; i < total; i++) {
      if (isInRollout(`user-${i}`, 'test-flag', target)) count++
    }
    const actual = (count / total) * 100
    expect(actual).toBeGreaterThan(target - 5)
    expect(actual).toBeLessThan(target + 5)
  })

  it('distributes users within ±5% of expected percentage at 50% rollout', () => {
    const total  = 10_000
    const target = 50
    let count    = 0
    for (let i = 0; i < total; i++) {
      if (isInRollout(`user-${i}`, 'test-flag', target)) count++
    }
    const actual = (count / total) * 100
    expect(actual).toBeGreaterThan(target - 5)
    expect(actual).toBeLessThan(target + 5)
  })

  it('different flags give different buckets for same user', () => {
    let sameCount = 0
    for (let i = 0; i < 100; i++) {
      const r1 = isInRollout(`user-${i}`, 'flag-a', 50)
      const r2 = isInRollout(`user-${i}`, 'flag-b', 50)
      if (r1 === r2) sameCount++
    }
    // Should not be identical for all users (would mean no differentiation)
    expect(sameCount).toBeLessThan(100)
  })
})

describe('assignVariant', () => {
  const variants = [
    { key: 'control',   weight: 50 },
    { key: 'treatment', weight: 50 },
  ]

  it('returns null for empty variants', () => {
    expect(assignVariant('usr_123', 'exp', [])).toBeNull()
  })

  it('returns null when weights do not sum to 100', () => {
    expect(assignVariant('usr_123', 'exp', [
      { key: 'a', weight: 40 },
      { key: 'b', weight: 40 },
    ])).toBeNull()
  })

  it('is deterministic', () => {
    const v1 = assignVariant('usr_123', 'checkout-exp', variants)
    const v2 = assignVariant('usr_123', 'checkout-exp', variants)
    expect(v1).toBe(v2)
  })

  it('distributes variants within ±5% of weight at 50/50 split', () => {
    const total   = 10_000
    let control   = 0
    let treatment = 0
    for (let i = 0; i < total; i++) {
      const v = assignVariant(`user-${i}`, 'test-exp', variants)
      if (v === 'control')   control++
      if (v === 'treatment') treatment++
    }
    const controlPct   = (control   / total) * 100
    const treatmentPct = (treatment / total) * 100
    expect(controlPct).toBeGreaterThan(45)
    expect(controlPct).toBeLessThan(55)
    expect(treatmentPct).toBeGreaterThan(45)
    expect(treatmentPct).toBeLessThan(55)
  })

  it('always returns a valid variant key', () => {
    for (let i = 0; i < 1000; i++) {
      const v = assignVariant(`user-${i}`, 'exp', variants)
      expect(['control', 'treatment']).toContain(v)
    }
  })
})
