import murmur from 'murmurhash'

/**
 * Deterministically assign a user to a rollout bucket.
 *
 * Uses MurmurHash3 on the string "{userId}{flagKey}" to produce
 * a consistent 32-bit integer, then normalises to 0.0–100.0.
 *
 * The same userId + flagKey combination ALWAYS produces the same
 * bucket — no database, no session storage, no coordination needed.
 *
 * @param userId  The user identifier
 * @param flagKey The flag or experiment key
 * @param seed    Optional seed for test isolation (default: 0)
 * @returns       true if the user is within the given percentage
 */
export function isInRollout(
  userId:     string,
  flagKey:    string,
  percentage: number,
  seed = 0,
): boolean {
  if (percentage <= 0)   return false
  if (percentage >= 100) return true

  const input  = `${userId}${flagKey}`
  const hash   = murmur.v3(input, seed)
  // Normalise unsigned 32-bit integer to 0.0–100.0
  const bucket = ((hash >>> 0) / 0xFFFFFFFF) * 100

  return bucket < percentage
}

/**
 * Assign a user to a weighted variant.
 * weights must sum to 100.
 *
 * @param userId    The user identifier
 * @param key       The experiment key
 * @param variants  Array of { key: string, weight: number }
 * @returns         The assigned variant key, or null if weights don't sum to 100
 */
export function assignVariant(
  userId:   string,
  key:      string,
  variants: Array<{ key: string; weight: number }>,
  seed = 0,
): string | null {
  if (variants.length === 0) return null

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
  if (Math.abs(totalWeight - 100) > 0.01) return null  // weights must sum to 100

  const input  = `${userId}${key}`
  const hash   = murmur.v3(input, seed)
  const bucket = ((hash >>> 0) / 0xFFFFFFFF) * 100

  let cumulative = 0
  for (const variant of variants) {
    cumulative += variant.weight
    if (bucket < cumulative) return variant.key
  }

  // Fallback to last variant (handles floating point edge cases)
  return variants[variants.length - 1].key
}
