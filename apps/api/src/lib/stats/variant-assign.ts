import murmur from 'murmurhash'

export function assignVariant(
  userId:   string,
  expKey:   string,
  variants: Array<{ key: string; weight: number }>,
  seed = 0,
): string | null {
  if (variants.length === 0) return null
  const total = variants.reduce((s, v) => s + v.weight, 0)
  if (Math.abs(total - 100) > 0.01) return null

  const hash   = murmur.v3(`${userId}${expKey}`, seed)
  const bucket = ((hash >>> 0) / 0xFFFFFFFF) * 100

  let cumulative = 0
  for (const v of variants) {
    cumulative += v.weight
    if (bucket < cumulative) return v.key
  }
  return variants[variants.length - 1].key
}
