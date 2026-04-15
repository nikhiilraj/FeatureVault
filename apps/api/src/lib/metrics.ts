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
