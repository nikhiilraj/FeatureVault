import { Worker } from 'bullmq'
import { redisClient } from './lib/redis/client.js'
import { env } from './lib/env.js'

console.log('🔧  FeatureVault worker starting...')

// Workers will be registered here in Phase 3 (experiments + events)
const connection = { host: new URL(env.REDIS_URL).hostname, port: Number(new URL(env.REDIS_URL).port) || 6379 }

console.log(`✅  Worker connected to Redis at ${env.REDIS_URL}`)

process.on('SIGTERM', async () => {
  console.log('Worker shutting down...')
  process.exit(0)
})
