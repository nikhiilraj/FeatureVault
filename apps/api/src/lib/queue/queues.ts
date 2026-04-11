import { Queue } from 'bullmq'
import { env } from '../env.js'

const connection = {
  host: new URL(env.REDIS_URL).hostname,
  port: Number(new URL(env.REDIS_URL).port) || 6379,
}

// SDK event processing queue
export const eventsQueue = new Queue('sdk-events', {
  connection,
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50 },
  },
})

// Aggregation queue (hourly stats calculation)
export const aggregationQueue = new Queue('aggregation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 10 },
  },
})

// Email queue
export const emailQueue = new Queue('email', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff:  { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 50 },
  },
})
