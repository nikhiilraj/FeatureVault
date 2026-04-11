import { describe, it, expect } from 'vitest'
import { createExperimentSchema } from '../experiments.schemas.js'

describe('createExperimentSchema', () => {
  const valid = {
    key: 'checkout-cta',
    name: 'Checkout CTA Test',
    primaryMetric: 'purchase_completed',
    variants: [
      { key: 'control',   name: 'Control',   weight: 50, value: { color: 'red' } },
      { key: 'treatment', name: 'Treatment', weight: 50, value: { color: 'green' } },
    ],
  }

  it('accepts valid experiment', () => {
    expect(createExperimentSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects uppercase key', () => {
    expect(createExperimentSchema.safeParse({ ...valid, key: 'Checkout-CTA' }).success).toBe(false)
  })

  it('rejects weights not summing to 100', () => {
    const bad = { ...valid, variants: [
      { key: 'a', name: 'A', weight: 40, value: {} },
      { key: 'b', name: 'B', weight: 40, value: {} },
    ]}
    expect(createExperimentSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects fewer than 2 variants', () => {
    const bad = { ...valid, variants: [{ key: 'a', name: 'A', weight: 100, value: {} }] }
    expect(createExperimentSchema.safeParse(bad).success).toBe(false)
  })

  it('accepts confidence level 0.95', () => {
    expect(createExperimentSchema.safeParse({ ...valid, confidenceLevel: 0.95 }).success).toBe(true)
  })

  it('rejects confidence level below 0.8', () => {
    expect(createExperimentSchema.safeParse({ ...valid, confidenceLevel: 0.5 }).success).toBe(false)
  })

  it('accepts 3 variants summing to 100', () => {
    const three = { ...valid, variants: [
      { key: 'control',   name: 'Control',   weight: 34, value: {} },
      { key: 'variant-a', name: 'Variant A', weight: 33, value: {} },
      { key: 'variant-b', name: 'Variant B', weight: 33, value: {} },
    ]}
    expect(createExperimentSchema.safeParse(three).success).toBe(true)
  })
})
