import { createHash } from 'crypto'

/**
 * SHA-256 hash for SDK keys, refresh tokens, invitation tokens.
 * NOT for passwords — use argon2 for passwords.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Generate a cryptographically secure random token.
 */
export function generateToken(byteLength = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(byteLength))).toString('base64url')
}
