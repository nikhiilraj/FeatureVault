import { describe, it, expect } from 'vitest'
import { welchTTest, sampleSizeEstimate } from '../welch.js'

describe('welchTTest', () => {
  it('returns not significant for identical rates', () => {
    const result = welchTTest(
      { n: 1000, conversions: 50 },
      { n: 1000, conversions: 50 },
    )
    expect(result.isSignificant).toBe(false)
    expect(result.pValue).toBeGreaterThan(0.05)
    expect(result.uplift).toBeCloseTo(0)
  })

  it('returns significant for large difference with large sample', () => {
    const result = welchTTest(
      { n: 5000, conversions: 250 },
      { n: 5000, conversions: 500 },
    )
    expect(result.isSignificant).toBe(true)
    expect(result.pValue).toBeLessThan(0.05)
    expect(result.uplift).toBeCloseTo(1.0, 1)
  })

  it('returns not significant for small difference with small sample', () => {
    const result = welchTTest(
      { n: 100, conversions: 5 },
      { n: 100, conversions: 6 },
    )
    expect(result.isSignificant).toBe(false)
  })

  it('handles zero conversions in control', () => {
    const result = welchTTest(
      { n: 1000, conversions: 0 },
      { n: 1000, conversions: 50 },
    )
    expect(result.controlRate).toBe(0)
    expect(result.treatmentRate).toBeCloseTo(0.05)
  })

  it('handles unequal sample sizes', () => {
    const result = welchTTest(
      { n: 10000, conversions: 500 },
      { n: 500,   conversions: 35 },
    )
    expect(result.pValue).toBeGreaterThanOrEqual(0)
    expect(result.pValue).toBeLessThanOrEqual(1)
  })

  it('returns pValue between 0 and 1 for various inputs', () => {
    const cases = [
      [{ n: 100,  conversions: 10 }, { n: 100,  conversions: 15 }],
      [{ n: 500,  conversions: 25 }, { n: 500,  conversions: 50 }],
      [{ n: 1000, conversions: 100 }, { n: 900, conversions: 80 }],
    ]
    for (const [c, t] of cases) {
      const r = welchTTest(c, t)
      expect(r.pValue).toBeGreaterThanOrEqual(0)
      expect(r.pValue).toBeLessThanOrEqual(1)
    }
  })

  it('80% confidence is easier to reach than 95%', () => {
    const c = { n: 1000, conversions: 100 }
    const t = { n: 1000, conversions: 130 }
    const at95 = welchTTest(c, t, 0.95)
    const at80 = welchTTest(c, t, 0.80)
    if (at95.isSignificant) {
      expect(at80.isSignificant).toBe(true)
    }
  })
})

describe('sampleSizeEstimate', () => {
  it('returns a positive integer', () => {
    const n = sampleSizeEstimate(0.05, 0.20)
    expect(n).toBeGreaterThan(0)
    expect(Number.isInteger(n)).toBe(true)
  })

  it('larger effect requires smaller sample', () => {
    expect(sampleSizeEstimate(0.05, 0.10)).toBeGreaterThan(sampleSizeEstimate(0.05, 0.50))
  })

  it('higher confidence requires larger sample', () => {
    expect(sampleSizeEstimate(0.05, 0.20, 0.95)).toBeGreaterThan(sampleSizeEstimate(0.05, 0.20, 0.90))
  })

  it('returns reasonable estimate for common scenario', () => {
    const n = sampleSizeEstimate(0.05, 0.20, 0.95, 0.80)
    expect(n).toBeGreaterThan(500)
    expect(n).toBeLessThan(10_000)
  })
})
