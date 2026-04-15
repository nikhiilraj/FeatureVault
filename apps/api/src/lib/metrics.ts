import client from 'prom-client'

// Initialize the default registry
export const register = new client.Registry()

// Add default metrics (CPU, RAM, Node event loop lag, etc.)
client.collectDefaultMetrics({ register, prefix: 'fv_node_' })

// ─── Business Metric Definitions ──────────────────────────────

export const flagEvaluationsTotal = new client.Counter({
  name: 'fv_flag_evaluations_total',
  help: 'Total number of flag evaluations',
  labelNames: ['flag_key', 'result', 'project_id', 'environment'],
  registers: [register],
})

export const cacheHitsTotal = new client.Counter({
  name: 'fv_flag_cache_hits_total',
  help: 'Total flag caching mechanism hits',
  labelNames: ['cache_type'], // e.g., 'redis'
  registers: [register],
})

export const cacheMissesTotal = new client.Counter({
  name: 'fv_flag_cache_misses_total',
  help: 'Total flag caching mechanism misses',
  labelNames: ['cache_type'],
  registers: [register],
})

export const apiRequestDurationSeconds = new client.Histogram({
  name: 'fv_api_request_duration_seconds',
  help: 'Histogram of API request durations in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], // standard buckets
  registers: [register],
})

export const activeWsConnections = new client.Gauge({
  name: 'fv_ws_connections_active',
  help: 'Currently active SDK WebSocket connections',
  labelNames: ['project_id'],
  registers: [register],
})

export const eventsQueuedTotal = new client.Counter({
  name: 'fv_events_queued_total',
  help: 'Total SDK telemetry events queued to BullMQ',
  labelNames: ['event_type', 'project_id'],
  registers: [register],
})

export const sdkKeyAuthFailuresTotal = new client.Counter({
  name: 'fv_sdk_key_auth_failures_total',
  help: 'Total failed authentication attempts using SDK keys',
  labelNames: ['reason'], // e.g., 'invalid', 'revoked'
  registers: [register],
})

export const activeExperiments = new client.Gauge({
  name: 'fv_experiments_running',
  help: 'Currently running active A/B experiments',
  labelNames: ['project_id'],
  registers: [register],
})

// ─── Phase 1: Database Connections & Queue Depths ─────────────

export const pgPoolActiveConnections = new client.Gauge({
  name: 'fv_pg_pool_active_connections',
  help: 'Active connections in the Postgres pool',
  registers: [register],
})

export const pgPoolIdleConnections = new client.Gauge({
  name: 'fv_pg_pool_idle_connections',
  help: 'Idle connections in the Postgres pool',
  registers: [register],
})

export const pgPoolWaitingCount = new client.Gauge({
  name: 'fv_pg_pool_waiting_queries',
  help: 'Queries waiting for a Postgres connection',
  registers: [register],
})

export const bullmqJobsWaiting = new client.Gauge({
  name: 'fv_bullmq_jobs_waiting',
  help: 'Jobs waiting in BullMQ',
  labelNames: ['queue_name'],
  registers: [register],
})

export const bullmqJobsActive = new client.Gauge({
  name: 'fv_bullmq_jobs_active',
  help: 'Active jobs in BullMQ',
  labelNames: ['queue_name'],
  registers: [register],
})

export const bullmqJobsFailed = new client.Gauge({
  name: 'fv_bullmq_jobs_failed',
  help: 'Failed jobs in BullMQ',
  labelNames: ['queue_name'],
  registers: [register],
})

// ─── Phase 2 & 3: Mathematical Allocations & Security ──────────

export const experimentAllocationsTotal = new client.Counter({
  name: 'fv_experiment_allocations_total',
  help: 'Total deterministic mathematical traffic allocations by variant',
  labelNames: ['experiment_id', 'variant_id'],
  registers: [register],
})

export const rateLimitExceededTotal = new client.Counter({
  name: 'fv_rate_limit_exceeded_total',
  help: 'Total requests explicitly dropped by Redis sliding-window strict rate limiters',
  labelNames: ['endpoint'],
  registers: [register],
})
