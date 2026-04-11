import {
  pgTable, pgEnum, uuid, varchar, text, boolean,
  integer, numeric, jsonb, timestamp, index,
  uniqueIndex, primaryKey
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────
export const workspaceRoleEnum    = pgEnum('workspace_role',       ['owner','admin','editor','viewer'])
export const sdkKeyTypeEnum       = pgEnum('sdk_key_type',         ['server','client'])
export const sdkKeyEnvEnum        = pgEnum('sdk_key_environment',  ['production','staging','development','test'])
export const flagTypeEnum         = pgEnum('flag_type',            ['boolean','string','number','json'])
export const flagStatusEnum       = pgEnum('flag_status',          ['inactive','active','killed'])
export const experimentStatusEnum = pgEnum('experiment_status',    ['draft','running','paused','stopped','archived'])

// ─── Users ───────────────────────────────────────────────────
export const users = pgTable('users', {
  id:              uuid('id').primaryKey().defaultRandom(),
  email:           varchar('email', { length: 255 }).notNull().unique(),
  passwordHash:    text('password_hash').notNull(),
  firstName:       varchar('first_name', { length: 100 }),
  lastName:        varchar('last_name', { length: 100 }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  lastLoginAt:     timestamp('last_login_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash:  text('token_hash').notNull().unique(),
  ipAddress:  varchar('ip_address', { length: 45 }),
  userAgent:  text('user_agent'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx:  index('idx_sessions_user_id').on(t.userId),
  expiresIdx: index('idx_sessions_expires_at').on(t.expiresAt),
}))

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt:    timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index('idx_evt_user_id').on(t.userId),
}))

// ─── Workspaces ──────────────────────────────────────────────
export const workspaces = pgTable('workspaces', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 255 }).notNull(),
  slug:      varchar('slug', { length: 100 }).notNull().unique(),
  plan:      varchar('plan', { length: 20 }).notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:        workspaceRoleEnum('role').notNull().default('viewer'),
  joinedAt:    timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk:        primaryKey({ columns: [t.workspaceId, t.userId] }),
  userIdIdx: index('idx_wm_user_id').on(t.userId),
}))

export const workspaceInvitations = pgTable('workspace_invitations', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email:       varchar('email', { length: 255 }).notNull(),
  role:        workspaceRoleEnum('role').notNull(),
  tokenHash:   text('token_hash').notNull().unique(),
  invitedBy:   uuid('invited_by').notNull().references(() => users.id),
  expiresAt:   timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt:  timestamp('accepted_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  workspaceIdx: index('idx_wi_workspace_id').on(t.workspaceId),
  emailIdx:     index('idx_wi_email').on(t.email),
}))

// ─── Projects ────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 255 }).notNull(),
  slug:        varchar('slug', { length: 100 }).notNull(),
  description: text('description'),
  createdBy:   uuid('created_by').notNull().references(() => users.id),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  workspaceIdx:      index('idx_projects_workspace_id').on(t.workspaceId),
  workspaceSlugUniq: uniqueIndex('uq_projects_workspace_slug').on(t.workspaceId, t.slug),
}))

// ─── SDK Keys ────────────────────────────────────────────────
export const sdkKeys = pgTable('sdk_keys', {
  id:          uuid('id').primaryKey().defaultRandom(),
  projectId:   uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 255 }).notNull(),
  keyPrefix:   varchar('key_prefix', { length: 20 }).notNull(),
  keyHash:     text('key_hash').notNull().unique(),
  keyPreview:  varchar('key_preview', { length: 20 }).notNull(),
  keyType:     sdkKeyTypeEnum('key_type').notNull(),
  environment: sdkKeyEnvEnum('environment').notNull(),
  lastUsedAt:  timestamp('last_used_at', { withTimezone: true }),
  revokedAt:   timestamp('revoked_at', { withTimezone: true }),
  createdBy:   uuid('created_by').notNull().references(() => users.id),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectIdx: index('idx_sdk_keys_project_id').on(t.projectId),
}))

// ─── Feature Flags ───────────────────────────────────────────
export const flags = pgTable('flags', {
  id:               uuid('id').primaryKey().defaultRandom(),
  projectId:        uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  key:              varchar('key', { length: 128 }).notNull(),
  name:             varchar('name', { length: 255 }).notNull(),
  description:      text('description'),
  type:             flagTypeEnum('type').notNull().default('boolean'),
  defaultValue:     jsonb('default_value').notNull(),
  status:           flagStatusEnum('status').notNull().default('inactive'),
  targetingEnabled: boolean('targeting_enabled').notNull().default(false),
  // FIX: use sql cast for empty array defaults — Drizzle 0.30 bug with .array().default([])
  tags:             text('tags').array().default(sql`'{}'::text[]`),
  version:          integer('version').notNull().default(1),
  createdBy:        uuid('created_by').notNull().references(() => users.id),
  deletedAt:        timestamp('deleted_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectIdx:     index('idx_flags_project_id').on(t.projectId),
  projectKeyUniq: uniqueIndex('uq_flags_project_key').on(t.projectId, t.key),
}))

export const targetingRules = pgTable('targeting_rules', {
  id:                uuid('id').primaryKey().defaultRandom(),
  flagId:            uuid('flag_id').notNull().references(() => flags.id, { onDelete: 'cascade' }),
  ruleOrder:         integer('rule_order').notNull(),
  name:              varchar('name', { length: 255 }),
  conditions:        jsonb('conditions').notNull().default(sql`'[]'::jsonb`),
  serveValue:        jsonb('serve_value').notNull(),
  rolloutPercentage: integer('rollout_percentage').notNull().default(100),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  flagIdIdx:    index('idx_targeting_rules_flag_id').on(t.flagId),
  flagOrderUniq: uniqueIndex('uq_targeting_rules_flag_order').on(t.flagId, t.ruleOrder),
}))

export const flagVersions = pgTable('flag_versions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  flagId:       uuid('flag_id').notNull().references(() => flags.id, { onDelete: 'cascade' }),
  version:      integer('version').notNull(),
  snapshot:     jsonb('snapshot').notNull(),
  changedBy:    uuid('changed_by').notNull().references(() => users.id),
  changeReason: text('change_reason'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  flagIdIdx:   index('idx_flag_versions_flag_id').on(t.flagId),
  flagVerUniq: uniqueIndex('uq_flag_versions_flag_version').on(t.flagId, t.version),
}))

// ─── Experiments ─────────────────────────────────────────────
export const experiments = pgTable('experiments', {
  id:                uuid('id').primaryKey().defaultRandom(),
  projectId:         uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  key:               varchar('key', { length: 128 }).notNull(),
  name:              varchar('name', { length: 255 }).notNull(),
  hypothesis:        text('hypothesis'),
  status:            experimentStatusEnum('status').notNull().default('draft'),
  trafficAllocation: integer('traffic_allocation').notNull().default(100),
  primaryMetric:     varchar('primary_metric', { length: 128 }).notNull(),
  // FIX: sql cast for empty array default
  secondaryMetrics:  text('secondary_metrics').array().default(sql`'{}'::text[]`),
  confidenceLevel:   numeric('confidence_level', { precision: 4, scale: 3 }).notNull().default('0.950'),
  targetingRules:    jsonb('targeting_rules').default(sql`'[]'::jsonb`),
  startedAt:         timestamp('started_at', { withTimezone: true }),
  stoppedAt:         timestamp('stopped_at', { withTimezone: true }),
  winnerVariantId:   uuid('winner_variant_id'),
  createdBy:         uuid('created_by').notNull().references(() => users.id),
  deletedAt:         timestamp('deleted_at', { withTimezone: true }),
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  projectIdx:     index('idx_experiments_project_id').on(t.projectId),
  projectKeyUniq: uniqueIndex('uq_experiments_project_key').on(t.projectId, t.key),
}))

export const experimentVariants = pgTable('experiment_variants', {
  id:           uuid('id').primaryKey().defaultRandom(),
  experimentId: uuid('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  key:          varchar('key', { length: 128 }).notNull(),
  name:         varchar('name', { length: 255 }).notNull(),
  weight:       integer('weight').notNull(),
  value:        jsonb('value').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  experimentIdx: index('idx_exp_variants_experiment_id').on(t.experimentId),
  expKeyUniq:    uniqueIndex('uq_exp_variants_experiment_key').on(t.experimentId, t.key),
}))

// ─── Audit Logs ──────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  workspaceId:  uuid('workspace_id').notNull(),
  actorId:      uuid('actor_id'),
  actorEmail:   varchar('actor_email', { length: 255 }),
  action:       varchar('action', { length: 128 }).notNull(),
  resourceType: varchar('resource_type', { length: 64 }).notNull(),
  resourceId:   uuid('resource_id'),
  before:       jsonb('before'),
  after:        jsonb('after'),
  metadata:     jsonb('metadata'),
  ipAddress:    varchar('ip_address', { length: 45 }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  workspaceCreatedIdx: index('idx_audit_workspace_created').on(t.workspaceId, t.createdAt),
  actorIdx:            index('idx_audit_actor_id').on(t.actorId),
  resourceIdx:         index('idx_audit_resource').on(t.resourceType, t.resourceId),
}))

// ─── Relations ───────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  sessions:         many(sessions),
  workspaceMembers: many(workspaceMembers),
}))

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members:     many(workspaceMembers),
  invitations: many(workspaceInvitations),
  projects:    many(projects),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace:   one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  sdkKeys:     many(sdkKeys),
  flags:       many(flags),
  experiments: many(experiments),
}))

export const flagsRelations = relations(flags, ({ one, many }) => ({
  project:        one(projects, { fields: [flags.projectId], references: [projects.id] }),
  targetingRules: many(targetingRules),
  versions:       many(flagVersions),
}))

export const experimentsRelations = relations(experiments, ({ one, many }) => ({
  project:  one(projects, { fields: [experiments.projectId], references: [projects.id] }),
  variants: many(experimentVariants),
}))

// ─── Experiment Analytics (Phase 5) ─────────────────────────
export const experimentImpressions = pgTable('experiment_impressions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  experimentId: uuid('experiment_id').notNull(),
  variantId:    uuid('variant_id').notNull(),
  userId:       varchar('user_id', { length: 255 }).notNull(),
  sessionId:    varchar('session_id', { length: 255 }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  experimentVariantIdx: index('idx_imp_experiment_variant').on(t.experimentId, t.variantId),
  userIdx:              index('idx_imp_user_id').on(t.userId),
}))

export const experimentEvents = pgTable('experiment_events', {
  id:            uuid('id').primaryKey().defaultRandom(),
  experimentId:  uuid('experiment_id').notNull(),
  variantId:     uuid('variant_id').notNull(),
  userId:        varchar('user_id', { length: 255 }).notNull(),
  eventName:     varchar('event_name', { length: 128 }).notNull(),
  value:         numeric('value', { precision: 15, scale: 4 }),
  properties:    jsonb('properties'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  experimentEventIdx: index('idx_evt_experiment_event').on(t.experimentId, t.eventName),
  userIdx:            index('idx_evt_user').on(t.userId),
}))

export const experimentResults = pgTable('experiment_results', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  experimentId:        uuid('experiment_id').notNull(),
  variantId:           uuid('variant_id').notNull(),
  metricName:          varchar('metric_name', { length: 128 }).notNull(),
  impressions:         integer('impressions').notNull().default(0),
  conversions:         integer('conversions').notNull().default(0),
  conversionRate:      numeric('conversion_rate', { precision: 8, scale: 6 }).notNull().default('0'),
  uplift:              numeric('uplift', { precision: 8, scale: 6 }),
  pValue:              numeric('p_value', { precision: 10, scale: 8 }),
  isSignificant:       boolean('is_significant').notNull().default(false),
  sampleMean:          numeric('sample_mean', { precision: 15, scale: 8 }),
  sampleVariance:      numeric('sample_variance', { precision: 15, scale: 8 }),
  computedAt:          timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  experimentVariantMetricIdx: index('idx_results_exp_variant_metric')
    .on(t.experimentId, t.variantId, t.metricName),
}))
