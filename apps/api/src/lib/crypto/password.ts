import argon2 from 'argon2'

// Argon2id — OWASP 2024 recommended parameters
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}
