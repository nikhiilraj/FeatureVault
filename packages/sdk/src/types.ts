// ─── Flag types ──────────────────────────────────────────────
export type FlagType   = 'boolean' | 'string' | 'number' | 'json'
export type FlagStatus = 'inactive' | 'active' | 'killed'

export type ConditionOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'regex'

export interface TargetingCondition {
  attribute: string
  operator:  ConditionOperator
  value:     string | number | boolean | string[]
}

export interface TargetingRule {
  id:                string
  name?:             string
  conditions:        TargetingCondition[]
  serveValue:        unknown
  rolloutPercentage: number
  ruleOrder:         number
}

export interface FlagConfig {
  id:               string
  key:              string
  type:             FlagType
  status:           FlagStatus
  defaultValue:     unknown
  targetingEnabled: boolean
  targetingRules:   TargetingRule[]
  version:          number
  updatedAt:        string
}

// ─── User context ────────────────────────────────────────────
export type UserContext = Record<string, string | number | boolean | string[]>

// ─── WebSocket messages ──────────────────────────────────────
export type WSMessageType =
  | 'connected' | 'flag_updated' | 'flag_created' | 'flag_deleted'
  | 'ping' | 'pong' | 'error'

export interface WSMessage {
  type:       WSMessageType
  projectId?: string
  flagId?:    string
  flagKey?:   string
  changeType?: string
  payload?:   unknown
  serverTime?: string
}

// ─── SDK config ──────────────────────────────────────────────
export interface FeatureVaultConfig {
  apiKey:           string
  apiUrl?:          string
  wsUrl?:           string
  connectTimeout?:  number   // ms, default 10000
  flushInterval?:   number   // ms, default 2000
  flushBatchSize?:  number   // events, default 50
  debug?:           boolean
}

// ─── Track event ─────────────────────────────────────────────
export interface TrackEvent {
  eventName:     string
  userId:        string
  experimentKey?: string
  properties?:   Record<string, unknown>
  timestamp:     string
}
