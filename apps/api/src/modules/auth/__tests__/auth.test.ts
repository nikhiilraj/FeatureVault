import { describe, it, expect } from 'vitest'
import { signupSchema, loginSchema } from '../auth.schemas.js'
import { sha256, generateToken } from '../../../lib/crypto/hash.js'
import { hashPassword, verifyPassword } from '../../../lib/crypto/password.js'

describe('Auth schemas', () => {

  describe('signupSchema', () => {
    it('accepts a valid signup', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'ValidPass123!',
        firstName: 'Test',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = signupSchema.safeParse({ email: 'notanemail', password: 'ValidPass123!' })
      expect(result.success).toBe(false)
      expect(result.error?.errors[0].path[0]).toBe('email')
    })

    it('rejects short password', () => {
      const result = signupSchema.safeParse({ email: 'test@example.com', password: 'short' })
      expect(result.success).toBe(false)
      expect(result.error?.errors[0].path[0]).toBe('password')
    })

    it('rejects password without uppercase', () => {
      const result = signupSchema.safeParse({ email: 'test@example.com', password: 'validpass123!' })
      expect(result.success).toBe(false)
    })

    it('rejects password without number', () => {
      const result = signupSchema.safeParse({ email: 'test@example.com', password: 'ValidPassword!' })
      expect(result.success).toBe(false)
    })

    it('rejects password without special char', () => {
      const result = signupSchema.safeParse({ email: 'test@example.com', password: 'ValidPass1234' })
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('accepts valid login', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: 'anything' })
      expect(result.success).toBe(true)
    })

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({ email: 'test@example.com', password: '' })
      expect(result.success).toBe(false)
    })
  })
})

describe('Crypto helpers', () => {
  it('sha256 produces consistent 64-char hex', async () => {
    const hash1 = sha256('hello')
    const hash2 = sha256('hello')
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(hash1).toMatch(/^[0-9a-f]+$/)
  })

  it('sha256 different inputs produce different hashes', async () => {
    expect(sha256('hello')).not.toBe(sha256('world'))
  })

  it('generateToken produces url-safe base64', async () => {
    const token = generateToken(32)
    expect(token.length).toBeGreaterThan(20)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('hashPassword + verifyPassword round trip', async () => {
    const hash = await hashPassword('MyTestPassword123!')
    expect(await verifyPassword(hash, 'MyTestPassword123!')).toBe(true)
    expect(await verifyPassword(hash, 'WrongPassword123!')).toBe(false)
  }, 15000)
})
