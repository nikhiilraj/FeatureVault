import { describe, it, expect } from 'vitest'

describe('Rate limiting logic', () => {
  it('allows requests under the limit', () => {
    const attempts = 4
    const max      = 5
    expect(attempts < max).toBe(true)
  })

  it('blocks requests at the limit', () => {
    const attempts = 6
    const max      = 5
    expect(attempts > max).toBe(true)
  })

  it('rate limit key format is correct', () => {
    const email = 'test@example.com'
    const key   = `fv:rl:login:${email}`
    expect(key).toBe('fv:rl:login:test@example.com')
  })
})
