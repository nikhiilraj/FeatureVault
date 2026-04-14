import { describe, it, expect } from 'vitest'

describe('CLI utilities', () => {
  it('generates flag key from name', () => {
    const name = 'New Checkout Flow'
    const key  = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    expect(key).toBe('new-checkout-flow')
  })

  it('validates flag key format', () => {
    const valid   = (k: string) => /^[a-z0-9][a-z0-9-_]*$/.test(k)
    expect(valid('dark-mode')).toBe(true)
    expect(valid('checkout_v2')).toBe(true)
    expect(valid('Dark-Mode')).toBe(false)
    expect(valid('-dark-mode')).toBe(false)
    expect(valid('dark mode')).toBe(false)
  })

  it('parses JSON default values', () => {
    const parse = (v: string) => { try { return JSON.parse(v) } catch { return v } }
    expect(parse('false')).toBe(false)
    expect(parse('true')).toBe(true)
    expect(parse('42')).toBe(42)
    expect(parse('"hello"')).toBe('hello')
    expect(parse('not-json')).toBe('not-json')
  })
})
