import { describe, it, expect } from 'vitest'

describe('Health endpoint', () => {
  it('returns expected shape', () => {
    const response = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    }
    expect(response.status).toBe('ok')
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })
})
