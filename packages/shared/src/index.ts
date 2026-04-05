// Shared types across API, web dashboard, and SDK

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type FlagType      = 'boolean' | 'string' | 'number' | 'json'
export type FlagStatus    = 'inactive' | 'active' | 'killed'
export type SDKKeyType    = 'server' | 'client'
export type SDKKeyEnv     = 'production' | 'staging' | 'development' | 'test'
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'stopped' | 'archived'

export type ConditionOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'regex'

export interface TargetingCondition {
  attribute: string
  operator: ConditionOperator
  value: string | number | boolean | string[]
}

export interface TargetingRule {
  id: string
  name?: string
  conditions: TargetingCondition[]
  serveValue: unknown
  rolloutPercentage: number
  ruleOrder: number
}

export interface FlagConfig {
  id: string
  key: string
  type: FlagType
  status: FlagStatus
  defaultValue: unknown
  targetingEnabled: boolean
  targetingRules: TargetingRule[]
  version: number
  updatedAt: string
}

// WebSocket message types (SDK ↔ API)
export type WSMessageType =
  | 'flag_updated'
  | 'flag_created'
  | 'flag_deleted'
  | 'ping'
  | 'pong'
  | 'subscribe'
  | 'error'

export interface WSMessage {
  type: WSMessageType
  payload?: unknown
  serverTime?: string
}

// API response envelope
export interface ApiSuccess<T> {
  success: true
  data: T
  meta: { requestId: string; timestamp: string }
}

export interface ApiError {
  success: false
  error: { code: string; message: string; field?: string; docs?: string }
  meta: { requestId: string; timestamp: string }
}

export interface ApiPaginated<T> {
  success: true
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    hasMore: boolean
    nextCursor?: string
  }
  meta: { requestId: string; timestamp: string }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
