import { describe, it, expect } from 'vitest'

// Test the sanitization logic directly
function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 10) return value
  if (typeof value === 'string') {
    return value.replace(/\0/g, '').slice(0, 10_000)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 1000).map(v => sanitizeValue(v, depth + 1))
  }
  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitized[k.replace(/\0/g, '').slice(0, 256)] = sanitizeValue(v, depth + 1)
    }
    return sanitized
  }
  return value
}

describe('Input sanitization', () => {
  it('removes null bytes from strings', () => {
    expect(sanitizeValue('hello\0world')).toBe('helloworld')
  })

  it('truncates strings over 10000 chars', () => {
    const long = 'a'.repeat(15_000)
    expect((sanitizeValue(long) as string).length).toBe(10_000)
  })

  it('sanitizes nested object strings', () => {
    const input = { key: 'val\0ue', nested: { x: 'te\0st' } }
    const result = sanitizeValue(input) as Record<string, unknown>
    expect((result.key as string)).toBe('value')
    expect(((result.nested as Record<string, unknown>).x as string)).toBe('test')
  })

  it('sanitizes array elements', () => {
    const input = ['hello\0', 'world\0']
    const result = sanitizeValue(input) as string[]
    expect(result[0]).toBe('hello')
    expect(result[1]).toBe('world')
  })

  it('removes null bytes from object keys', () => {
    const input = { 'key\0name': 'value' }
    const result = sanitizeValue(input) as Record<string, unknown>
    expect(result['keyname']).toBe('value')
  })

  it('passes through numbers and booleans unchanged', () => {
    expect(sanitizeValue(42)).toBe(42)
    expect(sanitizeValue(true)).toBe(true)
    expect(sanitizeValue(null)).toBe(null)
  })

  it('limits depth to prevent stack overflow', () => {
    // Create deeply nested object
    let obj: Record<string, unknown> = { val: 'deep' }
    for (let i = 0; i < 15; i++) {
      obj = { nested: obj }
    }
    expect(() => sanitizeValue(obj)).not.toThrow()
  })
})
