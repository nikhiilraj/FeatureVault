# FeatureVault — Complete Architecture Lockdown Document

**Version:** 1.0.0
**Author:** Nikhil + Claude (Architecture Partner)
**Purpose:** Every decision locked before a single line of code is written.
**Rule:** If it's not in this document, it doesn't exist in V1.

---

## Part 1: Idea Validation & Scope Lock

### 1.1 What We're Building (One Sentence)

FeatureVault is a self-hostable feature flag and A/B testing platform where the SDK evaluates flags at sub-millisecond latency using a local in-memory store synced via WebSocket — zero network calls per flag check, ever.

### 1.2 Why This Is a God-Tier Resume Project

This project demonstrates mastery across every axis a senior engineer interviewer evaluates:

- **System design**: Real-time pub/sub architecture, stateless horizontal scaling, WebSocket connection management across distributed instances, consistent hashing for deterministic bucketing.
- **Database design**: Partitioned tables, JSONB targeting rules, audit log immutability, proper indexing strategy, soft deletes.
- **Security engineering**: Argon2id password hashing, RS256 JWT with refresh rotation, replay attack detection, RBAC at both API and UI layer, rate limiting, CSRF protection, SDK key hashing.
- **API design**: RESTful resource modeling, cursor-based pagination, idempotent operations, standard error envelopes, versioned SDK endpoints.
- **SDK engineering**: Published npm package with zero-network-call evaluation, in-memory flag store, event batching, exponential backoff reconnection, deterministic variant assignment via MurmurHash3.
- **Frontend architecture**: Next.js App Router, Zustand state management, TanStack Query for server state, WebSocket real-time UI, role-based component gating, accessible component library.
- **DevOps**: Docker multi-stage builds, Docker Compose for self-hosting, GitHub Actions CI/CD, Terraform IaC for AWS (ECS Fargate, RDS, ElastiCache, ALB).
- **Statistics**: Welch's two-sample t-test for A/B experiment significance, power analysis for sample size calculation.

### 1.3 Core Entities (The Nouns)

Before any architecture, here are the nouns in the system:

| Entity | Description | Growth Pattern |
|---|---|---|
| `User` | A person with an account | Slow (hundreds to low thousands) |
| `Session` | An active login session for a user | Moderate (multiple per user) |
| `Workspace` | A team/org container (like a GitHub org) | Slow (1 per team) |
| `WorkspaceMember` | Join table: User ↔ Workspace with role | Slow |
| `WorkspaceInvitation` | Pending invite to join a workspace | Slow, ephemeral |
| `Project` | A product/service within a workspace (like a repo) | Slow (2–10 per workspace) |
| `SDKKey` | API key scoped to a project + environment | Slow (2–5 per project) |
| `Flag` | A feature flag with targeting rules | Moderate (10–100 per project) |
| `TargetingRule` | A condition + rollout rule attached to a flag | Moderate (1–10 per flag) |
| `FlagVersion` | Immutable snapshot of a flag at each change | Moderate (grows with changes) |
| `Experiment` | An A/B test with variants and metrics | Moderate (5–20 per project) |
| `ExperimentVariant` | A variant within an experiment | Low (2–5 per experiment) |
| `ExperimentImpression` | Raw "user saw this variant" event | **Fast** (thousands/day) — needs partitioning |
| `ExperimentEvent` | Raw conversion event | **Fast** (thousands/day) — needs partitioning |
| `ExperimentResult` | Hourly aggregated stats per variant per metric | Moderate (hourly writes) |
| `AuditLog` | Immutable record of every system change | **Fast** (every mutation) — needs partitioning |
| `EmailVerificationToken` | One-time token for email verification | Slow, ephemeral |

### 1.4 Entity Relationships (The Verbs)

```
User ──────────── has many ──────── Sessions
User ──────────── has many ──────── WorkspaceMembers
User ──────────── has many ──────── EmailVerificationTokens

Workspace ─────── has many ──────── WorkspaceMembers
Workspace ─────── has many ──────── WorkspaceInvitations
Workspace ─────── has many ──────── Projects
Workspace ─────── has many ──────── AuditLogs

Project ──────── has many ──────── SDKKeys
Project ──────── has many ──────── Flags
Project ──────── has many ──────── Experiments

Flag ─────────── has many ──────── TargetingRules (ordered, top-down evaluation)
Flag ─────────── has many ──────── FlagVersions (immutable history)

Experiment ───── has many ──────── ExperimentVariants
Experiment ───── has many ──────── ExperimentImpressions (partitioned by month)
Experiment ───── has many ──────── ExperimentEvents (partitioned by month)
Experiment ───── has many ──────── ExperimentResults (hourly aggregation)

WorkspaceMember ── belongs to ──── User
WorkspaceMember ── belongs to ──── Workspace
```

### 1.5 Which Entities Grow Fast (Need Indexes + Partitioning)

| Entity | Strategy |
|---|---|
| `ExperimentImpressions` | Partitioned by `created_at` month. Indexes on `(experiment_id, variant_id)`, `(user_id)`. |
| `ExperimentEvents` | Partitioned by `created_at` month. Indexes on `(experiment_id, event_name)`, `(user_id)`. |
| `AuditLogs` | Partitioned by `created_at` month. Indexes on `(workspace_id, created_at DESC)`, `(actor_id)`, `(resource_type, resource_id)`. |
| Everything else | Standard tables, no partitioning needed at V1 scale. |

---

## Part 2: System Design & Architecture Decisions

### 2.1 Architecture Pattern: Modular Monolith

**Decision: Monolith. Not microservices. Not serverless.**

Rationale:
- Solo builder. Microservices add deployment, networking, service discovery, and debugging complexity that provides zero value at this scale.
- The monolith is structured as domain modules (auth, flags, experiments, audit, sdk, workspace) — each module owns its own routes, services, schemas, and types.
- If any module needs to scale independently in the future (unlikely for V1), the modular structure makes extraction trivial.
- The one exception: the BullMQ worker runs as a **separate process** (same codebase, different entry point). This is because background job processing has different scaling, memory, and failure characteristics than HTTP request handling. A stuck job should never block an API request.

```
┌─────────────────────────────────────────────────────────────┐
│                     NGINX / Caddy (Reverse Proxy)           │
│              TLS termination, rate limiting, static files   │
└─────────────┬─────────────────────────┬─────────────────────┘
              │                         │
              ▼                         ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│    Next.js 15 (Web)     │  │    Fastify v5 (API)     │
│    Port 3000            │  │    Port 4000            │
│                         │  │                         │
│  - Dashboard UI         │  │  - REST API             │
│  - Marketing pages      │  │  - SDK API              │
│  - Auth pages           │  │  - WebSocket server     │
│  - SSR + client hydrate │  │  - Redis pub/sub        │
└─────────────────────────┘  └──────────┬──────────────┘
                                        │
                              ┌─────────┴──────────┐
                              │                    │
                              ▼                    ▼
                    ┌──────────────┐     ┌──────────────┐
                    │ PostgreSQL 16│     │   Redis 7    │
                    │              │     │              │
                    │ - All data   │     │ - Flag cache │
                    │ - Partitioned│     │ - Rate limits│
                    │   tables     │     │ - Pub/Sub    │
                    │ - Full-text  │     │ - Sessions   │
                    │   search     │     │ - BullMQ     │
                    └──────────────┘     └──────────────┘
                                                │
                                        ┌───────┴───────┐
                                        │  BullMQ       │
                                        │  Worker       │
                                        │  (separate    │
                                        │   process)    │
                                        │               │
                                        │ - Event ingest│
                                        │ - Aggregation │
                                        │ - Email send  │
                                        │ - Partition   │
                                        │   maintenance │
                                        └───────────────┘
```

### 2.2 API Design Contract

**Decision: REST. Not GraphQL. Not tRPC.**

Rationale:
- REST is universally understood. Every SDK in every language can call REST.
- GraphQL adds schema stitching complexity, N+1 query dangers, and caching challenges that provide no value for this app's query patterns (we don't have deeply nested relational reads).
- tRPC requires TypeScript on both ends and kills our ability to build SDKs in other languages later.
- We use Zod schemas at the boundary for validation, and those same Zod schemas generate TypeScript types for both API and frontend — we get most of tRPC's type-safety benefit without the coupling.

**Two API domains (logically separated, same Fastify instance in V1):**

| Domain | Purpose | Auth Mechanism | Rate Limit |
|---|---|---|---|
| `/v1/*` (Dashboard API) | CRUD for flags, experiments, workspaces | `Authorization: Bearer <JWT>` | 120 req/min per user |
| `/sdk/v1/*` (SDK API) | Flag fetching, event tracking, WebSocket sync | `X-API-Key: fv_live_...` | 10,000 req/min per key |

**API versioning from day one.** All routes prefixed with `/v1/`. When V2 happens, old clients don't break.

**Standard response envelope (every single response follows this shape):**

```typescript
// Success
{
  success: true,
  data: T,
  meta: {
    requestId: string,    // UUID, also in response header X-Request-ID
    timestamp: string     // ISO 8601
  }
}

// Error
{
  success: false,
  error: {
    code: string,         // Machine-readable: "FLAG_KEY_ALREADY_EXISTS"
    message: string,      // Human-readable: "A flag with key 'x' already exists"
    field?: string,       // Which input field caused the error (for forms)
    docs?: string         // Link to error documentation
  },
  meta: {
    requestId: string,
    timestamp: string
  }
}

// Paginated list
{
  success: true,
  data: T[],
  pagination: {
    total: number,
    page: number,
    limit: number,
    hasMore: boolean,
    nextCursor?: string   // For cursor-based pagination (audit logs)
  },
  meta: { ... }
}
```

### 2.3 Pagination Strategy

**Decision: Offset-based for most lists. Cursor-based for audit logs and high-volume tables.**

| Endpoint | Strategy | Why |
|---|---|---|
| Flags list | Offset (`?page=1&limit=20`) | Small dataset (<100 flags per project), users expect page numbers |
| Experiments list | Offset | Same reasoning |
| Members list | Offset | Small dataset |
| Audit logs | Cursor (`?cursor=eyJ...&limit=50`) | High volume, append-only, offset pagination breaks with concurrent inserts |
| Experiment impressions | Cursor | High volume, partitioned |
| Flag versions | Cursor | Append-only history |

### 2.4 Async vs Sync Decision Map

Every operation in the system, classified:

**Synchronous (user waits for response):**
- Authentication (login, signup, token refresh, email verify)
- All CRUD operations (flags, experiments, workspaces, projects, SDK keys)
- Flag status changes (kill-switch, enable, disable)
- Flag evaluation (SDK — but this is local, no network)
- Variant assignment (SDK — also local)
- SDK initial flag fetch (`GET /sdk/v1/flags`)

**Asynchronous (fire and forget, queued via BullMQ):**
- Email delivery (verification, invitations, password reset)
- SDK event processing (impressions, conversions → write to DB)
- Hourly experiment aggregation (stats calculation)
- Monthly partition creation (DB maintenance)
- Audit log export to S3 (future, but designed for now)

**Real-time push (WebSocket, not request/response):**
- Flag change propagation to SDK instances
- Dashboard live flag change feed

### 2.5 Queue Architecture (BullMQ)

**Four named queues, each with its own purpose and scaling characteristics:**

| Queue Name | Purpose | Concurrency | Retry | Dead Letter |
|---|---|---|---|---|
| `sdk-events` | Process raw SDK events (impressions + conversions) | 10 workers | 3 attempts, exponential backoff | Yes — `sdk-events-dead` |
| `email` | Send transactional emails via SES/Nodemailer | 3 workers | 3 attempts, 30s delay | Yes — `email-dead` |
| `aggregation` | Hourly experiment stats calculation | 1 worker (sequential) | 3 attempts | Yes |
| `maintenance` | Monthly partition creation, stale data cleanup | 1 worker | 3 attempts | Yes |

**Scheduled jobs (cron via BullMQ repeatable):**
- Hourly aggregation: `0 * * * *` (every hour on the hour)
- Monthly partition creation: `0 0 25 * *` (25th of every month, creates next month's partitions)
- Session cleanup: `0 3 * * *` (3 AM daily, removes expired sessions)
- Stale audit log purge: `0 4 1 * *` (1st of month, removes audit logs older than 90 days)

### 2.6 Third-Party Services Map

| Service | Purpose | V1 Choice | Abstraction |
|---|---|---|---|
| Password hashing | Secure password storage | `argon2` npm package (libargon2 binding) | `src/lib/crypto/password.ts` |
| JWT signing | Access + refresh tokens | `@fastify/jwt` with RS256 key pair | `src/lib/auth/jwt.ts` |
| Email delivery | Transactional emails | Nodemailer + SMTP (dev: Mailhog, prod: AWS SES) | `src/lib/email/email-service.ts` |
| Hashing (non-crypto) | Rollout bucketing | `murmurhash` npm package (MurmurHash3) | `src/lib/hashing/bucket.ts` |
| Database | Primary data store | PostgreSQL 16 via `pg` driver + Drizzle ORM | `src/lib/db/client.ts` |
| Cache + Pub/Sub | Flag cache, rate limits, WS coordination | Redis 7 via `ioredis` | `src/lib/redis/client.ts` |
| Background jobs | Async processing | BullMQ 5 (backed by Redis) | `src/lib/queue/queue-service.ts` |

**Every third-party is wrapped in a service class. No direct calls from route handlers. Ever.**

### 2.7 WebSocket Architecture (The Hardest Part)

This is the critical system design challenge. WebSocket connections are stateful — they live on a specific server instance. When we have multiple API instances behind a load balancer, a flag change processed by Instance A needs to reach SDK clients connected to Instance B.

**Solution: Redis Pub/Sub as the coordination layer.**

```
                    ┌───────────────────────────────────────┐
                    │          Redis Pub/Sub Channel         │
                    │    fv:pubsub:flags:{projectId}        │
                    └──────┬──────────────┬─────────────────┘
                           │              │
                    ┌──────┴──────┐ ┌─────┴───────┐
                    │ API Instance│ │ API Instance │
                    │     A       │ │      B       │
                    │             │ │              │
                    │ WS Clients: │ │ WS Clients:  │
                    │  SDK-1      │ │  SDK-3       │
                    │  SDK-2      │ │  SDK-4       │
                    │  Dashboard-1│ │  Dashboard-2 │
                    └─────────────┘ └──────────────┘
```

**Flow when a flag is updated:**

1. Editor clicks "Enable Flag" in dashboard
2. API handler on Instance A writes to PostgreSQL, invalidates Redis cache
3. Instance A publishes message to `fv:pubsub:flags:{projectId}` Redis channel
4. ALL API instances (A, B, C...) receive the pub/sub message (they all subscribe on startup)
5. Each instance iterates its locally-connected WebSocket clients for that project
6. Each instance pushes the flag update to its connected clients
7. SDK clients update their in-memory FlagStore — next `isEnabled()` call returns new value
8. Dashboard clients update their Zustand flagStore — UI reflects change immediately

**Connection registry in Redis:**

```
fv:ws:connections:{instanceId}              → SET of connectionIds (local to instance)
fv:ws:project:{projectId}:connections       → SET of "{instanceId}:{connectionId}" (global)
```

Each instance registers its connections in Redis so we can track total active connections per project (for dashboard display and monitoring). When an instance shuts down gracefully, it cleans up its entries.

**Heartbeat protocol:**
- Client sends `{ type: "ping" }` every 30 seconds
- Server responds `{ type: "pong", serverTime: "..." }`
- If server receives no ping for 90 seconds, connection is considered dead and cleaned up
- If client receives no pong for 60 seconds, it initiates reconnection

**Reconnection protocol (SDK-side):**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap)
- On successful reconnect, SDK immediately calls `GET /sdk/v1/flags` to re-fetch full state
- This guarantees no missed updates during the disconnection window
- The `syncToken` from the initial fetch tells the server what version the client has

---

## Part 3: Complete Database Design

### 3.1 Design Principles

1. **Normalize by default (3NF).** Denormalize only where we've identified read-heavy queries that would otherwise require expensive JOINs.
2. **Every table gets `id` (UUID), `created_at`, `updated_at`** unless it's a join table or a partitioned high-volume table.
3. **Soft delete** for user-facing resources (flags, experiments, projects). `deleted_at TIMESTAMPTZ` column. Permanently purged after 30 days via maintenance job.
4. **Hard delete** for internal/ephemeral resources (sessions, email verification tokens, expired invitations).
5. **JSONB for flexible schemas** (targeting rule conditions, experiment config, flag default values) — but always with a Zod schema validating the shape at the API boundary.
6. **Partitioning for high-volume tables** (impressions, events, audit logs) by month on `created_at`.
7. **All foreign keys indexed.** Every `_id` column that references another table gets an index.
8. **All filter/sort columns indexed.** If the dashboard has a filter or sort on a column, that column has an index.

### 3.2 Complete Schema (Production-Ready SQL)

```sql
-- ================================================================
-- EXTENSIONS
-- ================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";          -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";            -- case-insensitive text for emails

-- ================================================================
-- ENUM TYPES (enforced at DB level, not just app level)
-- ================================================================
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE flag_type AS ENUM ('boolean', 'string', 'number', 'json');
CREATE TYPE flag_status AS ENUM ('inactive', 'active', 'killed');
CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'paused', 'stopped');
CREATE TYPE sdk_key_type AS ENUM ('server-side', 'client-side');
CREATE TYPE sdk_key_environment AS ENUM ('production', 'staging', 'development');
CREATE TYPE audit_action AS ENUM (
  'flag.created', 'flag.updated', 'flag.killed', 'flag.activated',
  'flag.deactivated', 'flag.deleted', 'flag.restored', 'flag.targeting_updated',
  'experiment.created', 'experiment.updated', 'experiment.launched',
  'experiment.paused', 'experiment.stopped', 'experiment.deleted',
  'sdk_key.created', 'sdk_key.revoked',
  'member.invited', 'member.role_changed', 'member.removed',
  'project.created', 'project.updated', 'project.deleted',
  'workspace.updated'
);
CREATE TYPE audit_resource_type AS ENUM (
  'flag', 'experiment', 'sdk_key', 'member', 'project', 'workspace'
);

-- ================================================================
-- USERS & AUTH
-- ================================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               CITEXT NOT NULL UNIQUE,     -- case-insensitive
  password_hash       TEXT NOT NULL,               -- argon2id
  full_name           VARCHAR(255),
  avatar_url          TEXT,
  email_verified_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- No additional indexes needed: email has UNIQUE (which creates an index)

CREATE TABLE sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash  TEXT NOT NULL UNIQUE,        -- SHA-256 of actual token
  ip_address          INET,
  user_agent          TEXT,
  expires_at          TIMESTAMPTZ NOT NULL,
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
-- refresh_token_hash has UNIQUE which creates an index

CREATE TABLE email_verification_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL UNIQUE,         -- SHA-256 of actual token
  expires_at          TIMESTAMPTZ NOT NULL,
  used_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_evt_user_id ON email_verification_tokens(user_id);

CREATE TABLE password_reset_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL UNIQUE,
  expires_at          TIMESTAMPTZ NOT NULL,
  used_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prt_user_id ON password_reset_tokens(user_id);

-- ================================================================
-- WORKSPACES & PROJECTS
-- ================================================================

CREATE TABLE workspaces (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  slug                VARCHAR(100) NOT NULL UNIQUE,
  plan                VARCHAR(20) NOT NULL DEFAULT 'free',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- slug has UNIQUE index

CREATE TABLE workspace_members (
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role                workspace_role NOT NULL DEFAULT 'viewer',
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX idx_wm_user_id ON workspace_members(user_id);
-- Primary key creates index on (workspace_id, user_id)

CREATE TABLE workspace_invitations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email               CITEXT NOT NULL,
  role                workspace_role NOT NULL,
  token_hash          TEXT NOT NULL UNIQUE,
  invited_by          UUID NOT NULL REFERENCES users(id),
  expires_at          TIMESTAMPTZ NOT NULL,
  accepted_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wi_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX idx_wi_email ON workspace_invitations(email);

CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  slug                VARCHAR(100) NOT NULL,
  description         TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  deleted_at          TIMESTAMPTZ,                 -- soft delete
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);

-- ================================================================
-- SDK KEYS
-- ================================================================

CREATE TABLE sdk_keys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name                VARCHAR(255) NOT NULL,
  key_prefix          VARCHAR(20) NOT NULL,        -- 'fv_live_' or 'fv_test_'
  key_hash            TEXT NOT NULL UNIQUE,         -- SHA-256 of full key
  key_preview         VARCHAR(20) NOT NULL,         -- '...a3f2' (last 4 chars)
  key_type            sdk_key_type NOT NULL,
  environment         sdk_key_environment NOT NULL,
  last_used_at        TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sdk_keys_project_id ON sdk_keys(project_id);
-- key_hash has UNIQUE index

-- ================================================================
-- FEATURE FLAGS
-- ================================================================

CREATE TABLE flags (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key                 VARCHAR(128) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  type                flag_type NOT NULL DEFAULT 'boolean',
  default_value       JSONB NOT NULL,
  status              flag_status NOT NULL DEFAULT 'inactive',
  targeting_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  tags                TEXT[] DEFAULT '{}',
  version             INTEGER NOT NULL DEFAULT 1,
  created_by          UUID NOT NULL REFERENCES users(id),
  deleted_at          TIMESTAMPTZ,                 -- soft delete
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);
CREATE INDEX idx_flags_project_id ON flags(project_id);
CREATE INDEX idx_flags_status ON flags(project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_flags_tags ON flags USING GIN(tags) WHERE deleted_at IS NULL;

CREATE TABLE targeting_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id             UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  rule_order          INTEGER NOT NULL,
  name                VARCHAR(255),
  conditions          JSONB NOT NULL DEFAULT '[]',
  serve_value         JSONB NOT NULL,
  rollout_percentage  INTEGER NOT NULL DEFAULT 100
                      CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_targeting_rules_flag_id ON targeting_rules(flag_id);
-- Composite unique to prevent duplicate ordering
CREATE UNIQUE INDEX idx_targeting_rules_flag_order ON targeting_rules(flag_id, rule_order);

CREATE TABLE flag_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id             UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL,
  snapshot            JSONB NOT NULL,              -- full flag config at this version
  changed_by          UUID NOT NULL REFERENCES users(id),
  change_reason       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(flag_id, version)
);
CREATE INDEX idx_flag_versions_flag_id ON flag_versions(flag_id);

-- ================================================================
-- A/B EXPERIMENTS
-- ================================================================

CREATE TABLE experiments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key                 VARCHAR(128) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  hypothesis          TEXT,
  status              experiment_status NOT NULL DEFAULT 'draft',
  traffic_allocation  INTEGER NOT NULL DEFAULT 100
                      CHECK (traffic_allocation BETWEEN 0 AND 100),
  primary_metric      VARCHAR(128) NOT NULL,
  secondary_metrics   TEXT[] DEFAULT '{}',
  confidence_level    NUMERIC(4,3) NOT NULL DEFAULT 0.950,
  targeting_rules     JSONB DEFAULT '[]',
  started_at          TIMESTAMPTZ,
  stopped_at          TIMESTAMPTZ,
  winner_variant_id   UUID,
  created_by          UUID NOT NULL REFERENCES users(id),
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);
CREATE INDEX idx_experiments_project_id ON experiments(project_id);
CREATE INDEX idx_experiments_status ON experiments(project_id, status) WHERE deleted_at IS NULL;

CREATE TABLE experiment_variants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  key                 VARCHAR(128) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  weight              INTEGER NOT NULL CHECK (weight BETWEEN 0 AND 100),
  value               JSONB NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, key)
);
CREATE INDEX idx_exp_variants_experiment_id ON experiment_variants(experiment_id);

-- Partitioned by created_at month
CREATE TABLE experiment_impressions (
  id                  UUID NOT NULL DEFAULT gen_random_uuid(),
  experiment_id       UUID NOT NULL,
  variant_id          UUID NOT NULL,
  user_id             VARCHAR(255) NOT NULL,       -- application's user ID
  session_id          VARCHAR(255),
  properties          JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_exp_imp_experiment ON experiment_impressions(experiment_id, variant_id);
CREATE INDEX idx_exp_imp_user ON experiment_impressions(experiment_id, user_id);
CREATE INDEX idx_exp_imp_created ON experiment_impressions(created_at);

-- Create partitions for initial months
CREATE TABLE experiment_impressions_2026_01 PARTITION OF experiment_impressions
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE experiment_impressions_2026_02 PARTITION OF experiment_impressions
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE experiment_impressions_2026_03 PARTITION OF experiment_impressions
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE experiment_impressions_2026_04 PARTITION OF experiment_impressions
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE experiment_impressions_2026_05 PARTITION OF experiment_impressions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE experiment_impressions_2026_06 PARTITION OF experiment_impressions
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Conversion events (same partitioning strategy)
CREATE TABLE experiment_events (
  id                  UUID NOT NULL DEFAULT gen_random_uuid(),
  experiment_id       UUID NOT NULL,
  variant_id          UUID NOT NULL,
  user_id             VARCHAR(255) NOT NULL,
  event_name          VARCHAR(128) NOT NULL,
  properties          JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_exp_evt_experiment ON experiment_events(experiment_id, event_name);
CREATE INDEX idx_exp_evt_user ON experiment_events(experiment_id, user_id);
CREATE INDEX idx_exp_evt_created ON experiment_events(created_at);

CREATE TABLE experiment_events_2026_01 PARTITION OF experiment_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE experiment_events_2026_02 PARTITION OF experiment_events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE experiment_events_2026_03 PARTITION OF experiment_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE experiment_events_2026_04 PARTITION OF experiment_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE experiment_events_2026_05 PARTITION OF experiment_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE experiment_events_2026_06 PARTITION OF experiment_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Hourly aggregated results
CREATE TABLE experiment_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       UUID NOT NULL REFERENCES experiments(id),
  variant_id          UUID NOT NULL REFERENCES experiment_variants(id),
  metric_name         VARCHAR(128) NOT NULL,
  impressions         BIGINT NOT NULL DEFAULT 0,
  conversions         BIGINT NOT NULL DEFAULT 0,
  conversion_rate     NUMERIC(8,6),
  p_value             NUMERIC(10,8),
  confidence_interval JSONB,                       -- { lower, upper }
  is_significant      BOOLEAN,
  aggregated_at       TIMESTAMPTZ NOT NULL,
  UNIQUE(experiment_id, variant_id, metric_name, aggregated_at)
);
CREATE INDEX idx_exp_results_experiment ON experiment_results(experiment_id);

-- ================================================================
-- AUDIT LOGS (partitioned, immutable)
-- ================================================================

CREATE TABLE audit_logs (
  id                  UUID NOT NULL DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL,
  project_id          UUID,
  actor_id            UUID NOT NULL,
  actor_email         VARCHAR(255) NOT NULL,
  actor_role          workspace_role NOT NULL,
  action              audit_action NOT NULL,
  resource_type       audit_resource_type NOT NULL,
  resource_id         UUID NOT NULL,
  resource_key        VARCHAR(255),
  before_state        JSONB,
  after_state         JSONB,
  ip_address          INET,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE audit_logs_2026_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_logs_2026_04 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_logs_2026_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE audit_logs_2026_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- ================================================================
-- IMMUTABILITY TRIGGER FOR AUDIT LOGS
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are not permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();

-- ================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_flags_updated_at BEFORE UPDATE ON flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_targeting_rules_updated_at BEFORE UPDATE ON targeting_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_experiments_updated_at BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3.3 Normalization Decisions

| Decision | Approach | Rationale |
|---|---|---|
| Targeting rule conditions | JSONB in `targeting_rules.conditions` | Conditions are a flexible array of `{attribute, operator, value}` objects. Normalizing these into separate tables would create massive JOINs for every flag evaluation. Zod validates the shape at API boundary. |
| Flag default values | JSONB in `flags.default_value` | Default value can be boolean, string, number, or JSON object depending on flag type. JSONB handles all cases. |
| Experiment targeting rules | JSONB in `experiments.targeting_rules` | Same rationale as flag targeting — flexible, validated at boundary. |
| Experiment variant values | JSONB in `experiment_variants.value` | Variant values can be any type. |
| Flag version snapshots | JSONB in `flag_versions.snapshot` | Full snapshot of flag state at that version. Queried rarely, always as a complete object. |
| Audit log before/after state | JSONB in `audit_logs.before_state` / `after_state` | Captures the full state diff. Queried rarely, displayed as JSON diff in UI. |
| Tags on flags | `TEXT[]` array on `flags.tags` | Simple string array with GIN index. No need for a separate tags table at V1 scale. |
| Secondary metrics | `TEXT[]` array on `experiments.secondary_metrics` | Simple string list, rarely queried independently. |

**Denormalization decisions:**
| What | Why |
|---|---|
| `actor_email` and `actor_role` stored directly in `audit_logs` | Audit logs must be independently readable even if the user is deleted or role changes. Joining to `users` + `workspace_members` at query time would lose historical accuracy. |
| `key_preview` stored in `sdk_keys` | Avoids decrypting/unhashing the key just to show the last 4 chars in the UI. Computed once on creation. |

### 3.4 Redis Key Design (Complete)

```
# ──────────────────────────────────────
# FLAG CACHE
# ──────────────────────────────────────

# Full flag config for a project (used by SDK init fetch)
# Invalidated when any flag in the project changes
# TTL: 600s (10 min) — safety net, primary invalidation is via pub/sub
fv:flags:{projectId}                         → JSON string (all flags array)

# Individual flag cache (used by dashboard detail views)
# TTL: 600s
fv:flag:{projectId}:{flagKey}                → JSON string (single flag + rules)

# ──────────────────────────────────────
# RATE LIMITING (sliding window counters)
# ──────────────────────────────────────

# Login rate limit: 5 attempts per 15 min per email
fv:rl:login:{emailHash}                      → counter (TTL: 900s)

# Dashboard API rate limit: 120 req/min per user
fv:rl:api:{userId}                           → counter (TTL: 60s)

# SDK API rate limit: 10,000 req/min per API key
fv:rl:sdk:{apiKeyHash}                       → counter (TTL: 60s)

# Password reset rate limit: 3 per hour per email
fv:rl:reset:{emailHash}                      → counter (TTL: 3600s)

# ──────────────────────────────────────
# WEBSOCKET CONNECTION TRACKING
# ──────────────────────────────────────

# Which connections are subscribed to which project (for broadcast)
fv:ws:project:{projectId}                    → SET of "{instanceId}:{connectionId}"

# Instance-level connection list (for cleanup on shutdown)
fv:ws:instance:{instanceId}                  → SET of connectionIds (TTL: 120s, refreshed by heartbeat)

# ──────────────────────────────────────
# PUB/SUB CHANNELS
# ──────────────────────────────────────

# Published when any flag in a project changes
# All API instances subscribe to these channels for their connected projects
fv:pubsub:flags:{projectId}                  → message: JSON { flagKey, flag, changeType, timestamp }

# Published when an SDK key is revoked (force-disconnect)
fv:pubsub:key_revoked:{projectId}            → message: JSON { keyHash }

# ──────────────────────────────────────
# SESSION MANAGEMENT
# ──────────────────────────────────────

# Track valid sessions for immediate revocation
# When replay attack detected, delete this key → all sessions invalid
fv:sessions:{userId}                         → SET of session IDs (TTL: 7 days)

# ──────────────────────────────────────
# BULLMQ QUEUES (managed by BullMQ, listed for documentation)
# ──────────────────────────────────────

bull:sdk-events:*                            → SDK event processing queue
bull:email:*                                 → Email delivery queue
bull:aggregation:*                           → Hourly stats aggregation
bull:maintenance:*                           → Partition creation, cleanup

# ──────────────────────────────────────
# DASHBOARD CACHE (very short-lived)
# ──────────────────────────────────────

# Workspace flag summary (for dashboard overview)
fv:cache:dashboard:{workspaceId}:summary     → JSON (TTL: 10s)
```

---

## Part 4: Security Architecture

### 4.1 Authentication Flow (Complete)

**Signup flow:**
```
Client                        API                          PostgreSQL            Redis             Email
  │                            │                              │                   │                 │
  │ POST /auth/signup          │                              │                   │                 │
  │ { email, password, name }  │                              │                   │                 │
  │ ──────────────────────────►│                              │                   │                 │
  │                            │ Validate with Zod            │                   │                 │
  │                            │ Check email not taken ───────►│                   │                 │
  │                            │                              │                   │                 │
  │                            │ Hash password (argon2id)      │                   │                 │
  │                            │ params: m=65536, t=3, p=4    │                   │                 │
  │                            │                              │                   │                 │
  │                            │ BEGIN TRANSACTION            │                   │                 │
  │                            │ INSERT user ──────────────────►│                   │                 │
  │                            │ INSERT workspace ─────────────►│                   │                 │
  │                            │ INSERT workspace_member ──────►│ (role: owner)     │                 │
  │                            │ INSERT default project ────────►│                   │                 │
  │                            │ Generate verification token   │                   │                 │
  │                            │ INSERT email_verification ─────►│                   │                 │
  │                            │ COMMIT                        │                   │                 │
  │                            │                              │                   │                 │
  │                            │ Enqueue email job ─────────────────────────────────►│                 │
  │                            │                              │                   │ Process queue ──►│
  │                            │                              │                   │                 │ Send email
  │◄────────────────────────── │                              │                   │                 │
  │ 201 { userId, workspaceId }│                              │                   │                 │
  │ (NO token returned)        │                              │                   │                 │
```

**Login flow:**
```
Client                        API                          PostgreSQL            Redis
  │                            │                              │                   │
  │ POST /auth/login           │                              │                   │
  │ { email, password }        │                              │                   │
  │ ──────────────────────────►│                              │                   │
  │                            │ Check rate limit ───────────────────────────────►│
  │                            │                              │                   │ fv:rl:login:{hash}
  │                            │                              │                   │ < 5? Continue
  │                            │                              │                   │
  │                            │ Find user by email ──────────►│                   │
  │                            │ Verify argon2id hash          │                   │
  │                            │                              │                   │
  │                            │ Check email_verified_at != null                   │
  │                            │                              │                   │
  │                            │ Generate accessToken (JWT RS256, 15 min TTL)      │
  │                            │ Generate refreshToken (crypto random, 7 day TTL)  │
  │                            │                              │                   │
  │                            │ Hash refreshToken (SHA-256)   │                   │
  │                            │ INSERT session ───────────────►│                   │
  │                            │ Add session to Redis ──────────────────────────►│
  │                            │                              │                   │ fv:sessions:{userId}
  │                            │                              │                   │
  │◄────────────────────────── │                              │                   │
  │ 200 { accessToken, user }  │                              │                   │
  │ Set-Cookie: refreshToken   │                              │                   │
  │   HttpOnly, Secure,        │                              │                   │
  │   SameSite=Strict,         │                              │                   │
  │   Path=/auth/refresh       │                              │                   │
```

**Refresh flow:**
```
Client                        API                          PostgreSQL            Redis
  │                            │                              │                   │
  │ POST /auth/refresh         │                              │                   │
  │ Cookie: refreshToken       │                              │                   │
  │ ──────────────────────────►│                              │                   │
  │                            │ Read refreshToken from cookie │                   │
  │                            │ Hash it (SHA-256)             │                   │
  │                            │                              │                   │
  │                            │ Find session by hash ─────────►│                   │
  │                            │                              │                   │
  │                            │ IF session not found:          │                   │
  │                            │   This is a REPLAY ATTACK     │                   │
  │                            │   DELETE all sessions ─────────►│                   │
  │                            │   Delete Redis set ─────────────────────────────►│
  │                            │   Return 401                  │                   │
  │                            │                              │                   │
  │                            │ IF session found + not expired:│                   │
  │                            │   Delete old session ──────────►│                   │
  │                            │   Generate new refresh token   │                   │
  │                            │   INSERT new session ──────────►│                   │
  │                            │   Generate new access token    │                   │
  │                            │   Update Redis set ─────────────────────────────►│
  │                            │                              │                   │
  │◄────────────────────────── │                              │                   │
  │ 200 { accessToken }        │                              │                   │
  │ Set-Cookie: new refresh    │                              │                   │
```

### 4.2 JWT Structure

**Decision: RS256 (asymmetric) signing, not HS256.**

Rationale: RS256 allows us to distribute the public key for verification without exposing the signing secret. Future services can verify JWTs without sharing secrets. Also required for a proper JWKS endpoint.

**Access token payload:**
```json
{
  "sub": "usr_uuid",                    // user ID
  "email": "arjun@example.com",
  "iat": 1705312200,                    // issued at
  "exp": 1705313100,                    // expires (15 min)
  "jti": "tok_unique_id",              // JWT ID (for revocation)
  "workspaces": [                       // embedded for fast middleware checks
    {
      "id": "ws_uuid",
      "slug": "acme-corp",
      "role": "admin"
    }
  ]
}
```

**Why embed workspaces in the JWT:**
- Avoids a DB query on every single API request to check membership + role
- Workspaces change rarely (invites, role changes are infrequent)
- 15-minute TTL means stale workspace data corrects itself quickly
- On role change, we can force-expire all active tokens via Redis blacklist if needed

### 4.3 RBAC Middleware Design

**Permission model (not just roles — we define what each role can DO):**

```typescript
const PERMISSIONS = {
  // Workspace-level
  'workspace.update':          ['owner'],
  'workspace.delete':          ['owner'],
  'workspace.transfer':        ['owner'],
  'workspace.invite':          ['owner', 'admin'],
  'workspace.remove_member':   ['owner', 'admin'],
  'workspace.change_role':     ['owner', 'admin'],

  // Project-level
  'project.create':            ['owner', 'admin', 'editor'],
  'project.update':            ['owner', 'admin', 'editor'],
  'project.delete':            ['owner', 'admin'],

  // Flag-level
  'flag.create':               ['owner', 'admin', 'editor'],
  'flag.update':               ['owner', 'admin', 'editor'],
  'flag.delete':               ['owner', 'admin', 'editor'],
  'flag.kill':                 ['owner', 'admin', 'editor'],
  'flag.force_enable':         ['owner', 'admin'],       // production force-enable
  'flag.read':                 ['owner', 'admin', 'editor', 'viewer'],

  // Experiment-level
  'experiment.create':         ['owner', 'admin', 'editor'],
  'experiment.update':         ['owner', 'admin', 'editor'],
  'experiment.launch':         ['owner', 'admin', 'editor'],
  'experiment.stop':           ['owner', 'admin', 'editor'],
  'experiment.delete':         ['owner', 'admin'],
  'experiment.read':           ['owner', 'admin', 'editor', 'viewer'],

  // SDK Keys
  'sdk_key.create':            ['owner', 'admin'],
  'sdk_key.revoke':            ['owner', 'admin'],
  'sdk_key.read':              ['owner', 'admin', 'editor', 'viewer'],

  // Audit logs
  'audit_log.read':            ['owner', 'admin', 'editor', 'viewer'],
  'audit_log.export':          ['owner', 'admin'],
} as const;
```

**Middleware chain for every protected route:**

```
Request
  │
  ├── 1. Rate Limit Middleware (Redis sliding window)
  │     └── 429 if exceeded
  │
  ├── 2. Auth Middleware (JWT verification)
  │     └── 401 if invalid/expired
  │     └── Attaches user + workspaces to request
  │
  ├── 3. Workspace Middleware (extract workspace from URL param)
  │     └── 403 if user is not a member of this workspace
  │     └── Attaches workspace + role to request
  │
  ├── 4. Permission Middleware (check role against required permission)
  │     └── 403 if role lacks permission
  │
  ├── 5. Input Validation Middleware (Zod schema)
  │     └── 400 if validation fails
  │
  └── 6. Route Handler (calls service layer)
```

### 4.4 SDK Key Authentication

SDK endpoints use a completely different auth mechanism — no JWT, no cookies.

```
SDK Request
  │
  ├── 1. Extract X-API-Key header
  │     └── 401 if missing
  │
  ├── 2. SHA-256 hash the key
  │
  ├── 3. Look up key_hash in sdk_keys table (or Redis cache)
  │     └── 401 if not found
  │     └── 401 if revoked_at is set
  │
  ├── 4. Rate limit by key hash (10,000 req/min)
  │     └── 429 if exceeded
  │
  ├── 5. Extract project_id from the key record
  │     └── Attaches project context to request
  │
  ├── 6. Update last_used_at (async, non-blocking — fire-and-forget DB update)
  │
  └── 7. Route Handler
```

### 4.5 Input Validation Strategy

**Rule: Validate at the API boundary with Zod. Never inside services. Never trust anything from the client.**

Every endpoint has a Zod schema that validates:
- Request body (for POST/PUT/PATCH)
- Query parameters (for GET with filters)
- URL parameters (UUIDs are validated as UUID format)

**Example — flag creation schema:**
```typescript
const createFlagSchema = z.object({
  key: z.string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9-_]*$/, 'Key must be URL-safe lowercase'),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.enum(['boolean', 'string', 'number', 'json']),
  defaultValue: z.union([z.boolean(), z.string(), z.number(), z.record(z.unknown())]),
  tags: z.array(z.string().max(50)).max(10).optional(),
});
```

**XSS prevention:** All string inputs are sanitized using a whitelist approach (strip HTML tags). Zod `.transform()` is used to sanitize after validation.

**SQL injection prevention:** Drizzle ORM uses parameterized queries exclusively. No string concatenation of SQL ever. This is enforced by the ORM's API design, not by developer discipline.

### 4.6 Rate Limiting Implementation

**Algorithm: Sliding window counter (Redis).**

Not a simple counter — we use the sliding window algorithm to avoid the burst-at-boundary problem that fixed windows have.

```typescript
// Sliding window rate limiter
// Uses two Redis keys: current window and previous window
// Weighted average gives smooth rate limiting

async function isRateLimited(key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const currentWindow = Math.floor(now / windowSec) * windowSec;
  const previousWindow = currentWindow - windowSec;
  const elapsed = now - currentWindow;
  const weight = (windowSec - elapsed) / windowSec;

  const [prevCount, currCount] = await redis.mget(
    `${key}:${previousWindow}`,
    `${key}:${currentWindow}`
  );

  const rate = (parseInt(prevCount || '0') * weight) + parseInt(currCount || '0');
  return rate >= limit;
}
```

**Rate limits by endpoint category:**

| Category | Limit | Window | Key |
|---|---|---|---|
| Login attempts | 5 | 15 min | `fv:rl:login:{emailHash}` |
| Password reset | 3 | 1 hour | `fv:rl:reset:{emailHash}` |
| Signup | 3 | 1 hour | `fv:rl:signup:{ipHash}` |
| Dashboard API (authenticated) | 120 | 1 min | `fv:rl:api:{userId}` |
| SDK API (per key) | 10,000 | 1 min | `fv:rl:sdk:{keyHash}` |
| SDK events endpoint | 100 | 1 min | `fv:rl:sdk:events:{keyHash}` |
| Email verification resend | 3 | 1 hour | `fv:rl:verify:{userId}` |

All rate-limited responses return:
```
HTTP 429 Too Many Requests
Retry-After: <seconds until window resets>
X-RateLimit-Limit: <max requests>
X-RateLimit-Remaining: <requests left>
X-RateLimit-Reset: <Unix timestamp when window resets>
```

### 4.7 Security Headers

```typescript
// Applied to every response via Fastify hook
const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",        // Tailwind needs inline
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' wss://*.featurevault.io",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',                     // Disabled per OWASP (modern CSP handles it)
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
```

### 4.8 CORS Configuration

```typescript
const corsConfig = {
  origin: [
    process.env.WEB_URL,                        // Dashboard frontend
    'http://localhost:3000',                     // Local development
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials: true,                            // Required for cookies
  maxAge: 86400,                               // Preflight cache: 24h
};
```

SDK endpoints have a separate, more permissive CORS config (any origin, since SDKs run on customer domains).

---

## Part 5: Complete API Design

### 5.1 Authentication Endpoints

```
POST   /v1/auth/signup
  Body: { email, password, fullName }
  Response: 201 { userId, workspaceId }
  Rate limit: 3/hour per IP

POST   /v1/auth/login
  Body: { email, password }
  Response: 200 { accessToken, user: { id, email, fullName, workspaces[] } }
  Cookie: refreshToken (HttpOnly, Secure, SameSite=Strict, Path=/v1/auth/refresh, 7d)
  Rate limit: 5/15min per email

POST   /v1/auth/logout
  Auth: Bearer token
  Response: 200 { success: true }
  Side effect: Delete session from DB + Redis

POST   /v1/auth/refresh
  Cookie: refreshToken
  Response: 200 { accessToken }
  Cookie: new refreshToken (rotated)
  Error: 401 if token reused (replay attack → all sessions killed)

POST   /v1/auth/verify-email
  Body: { token }
  Response: 200 { verified: true }

POST   /v1/auth/resend-verification
  Auth: Bearer token
  Response: 200 { sent: true }
  Rate limit: 3/hour per user

POST   /v1/auth/forgot-password
  Body: { email }
  Response: 200 { sent: true }  // Always 200, even if email not found (anti-enumeration)
  Rate limit: 3/hour per email

POST   /v1/auth/reset-password
  Body: { token, newPassword }
  Response: 200 { success: true }

GET    /v1/auth/me
  Auth: Bearer token
  Response: 200 { user, workspaces[] }

GET    /v1/auth/.well-known/jwks.json
  Response: 200 { keys: [{ kty, n, e, kid, alg }] }  // Public key for JWT verification
```

### 5.2 Workspace & Project Endpoints

```
GET    /v1/workspaces/:workspaceId
  Auth: Bearer (member)
  Response: 200 { workspace, memberCount, projectCount }

PATCH  /v1/workspaces/:workspaceId
  Auth: Bearer (owner)
  Body: { name }
  Response: 200 { workspace }

GET    /v1/workspaces/:workspaceId/members
  Auth: Bearer (member)
  Response: 200 { members[] }

POST   /v1/workspaces/:workspaceId/invitations
  Auth: Bearer (owner|admin)
  Body: { email, role }
  Response: 201 { invitation }
  Side effect: Sends invitation email

PATCH  /v1/workspaces/:workspaceId/members/:userId
  Auth: Bearer (owner|admin)
  Body: { role }
  Response: 200 { member }

DELETE /v1/workspaces/:workspaceId/members/:userId
  Auth: Bearer (owner|admin)
  Response: 200 { removed: true }

POST   /v1/invitations/:token/accept
  Auth: Bearer (any authenticated user)
  Response: 200 { workspace, role }

GET    /v1/workspaces/:workspaceId/projects
  Auth: Bearer (member)
  Response: 200 { projects[] }

POST   /v1/workspaces/:workspaceId/projects
  Auth: Bearer (owner|admin|editor)
  Body: { name, slug?, description? }
  Response: 201 { project, sdkKeys: { serverSide, clientSide } }
  Side effect: Auto-generates initial SDK keys

GET    /v1/projects/:projectId
  Auth: Bearer (member of parent workspace)
  Response: 200 { project }

PATCH  /v1/projects/:projectId
  Auth: Bearer (owner|admin|editor)
  Body: { name?, description? }
  Response: 200 { project }

DELETE /v1/projects/:projectId
  Auth: Bearer (owner|admin)
  Response: 200 { deleted: true }
  Side effect: Soft delete (sets deleted_at)
```

### 5.3 Flag Endpoints

```
GET    /v1/projects/:projectId/flags
  Auth: Bearer (member)
  Query: ?status=active&tags=payments&search=checkout&page=1&limit=20&sort=created_at&order=desc
  Response: 200 { flags[], pagination }

POST   /v1/projects/:projectId/flags
  Auth: Bearer (owner|admin|editor)
  Body: { key, name, description?, type, defaultValue, tags? }
  Response: 201 { flag }
  Side effects: Creates flag_version v1, creates audit_log, invalidates Redis cache

GET    /v1/flags/:flagId
  Auth: Bearer (member)
  Response: 200 { flag, targetingRules[] }

PUT    /v1/flags/:flagId
  Auth: Bearer (owner|admin|editor)
  Body: { name?, description?, defaultValue?, targetingEnabled?, rules? }
  Response: 200 { flag }
  Side effects: Increments version, creates flag_version snapshot, audit_log,
                invalidates Redis cache, publishes to pub/sub → WS push

PATCH  /v1/flags/:flagId/status
  Auth: Bearer (owner|admin|editor for kill/deactivate; owner|admin for force-enable)
  Body: { status: 'active' | 'inactive' | 'killed' }
  Response: 200 { flag }
  Side effects: audit_log, Redis invalidation, WS push

DELETE /v1/flags/:flagId
  Auth: Bearer (owner|admin|editor)
  Response: 200 { deleted: true }
  Side effect: Soft delete

GET    /v1/flags/:flagId/versions
  Auth: Bearer (member)
  Query: ?cursor=...&limit=20
  Response: 200 { versions[], pagination }

GET    /v1/flags/:flagId/versions/:version
  Auth: Bearer (member)
  Response: 200 { version, snapshot }

POST   /v1/flags/:flagId/versions/:version/restore
  Auth: Bearer (owner|admin)
  Response: 200 { flag }
  Side effect: Restores flag to snapshot state, creates new version
```

### 5.4 Experiment Endpoints

```
GET    /v1/projects/:projectId/experiments
  Auth: Bearer (member)
  Query: ?status=running&page=1&limit=20
  Response: 200 { experiments[], pagination }

POST   /v1/projects/:projectId/experiments
  Auth: Bearer (owner|admin|editor)
  Body: {
    key, name, hypothesis?,
    variants: [{ key, name, weight, value }],
    primaryMetric, secondaryMetrics?,
    trafficAllocation?, confidenceLevel?,
    targetingRules?
  }
  Response: 201 { experiment, variants[] }
  Validation: Variant weights must sum to 100

GET    /v1/experiments/:experimentId
  Auth: Bearer (member)
  Response: 200 { experiment, variants[] }

PUT    /v1/experiments/:experimentId
  Auth: Bearer (owner|admin|editor)
  Constraint: Only allowed when status is 'draft'
  Response: 200 { experiment }

POST   /v1/experiments/:experimentId/launch
  Auth: Bearer (owner|admin|editor)
  Constraint: Status must be 'draft', at least 2 variants
  Response: 200 { experiment }  // status → running, started_at set
  Side effect: audit_log

POST   /v1/experiments/:experimentId/pause
  Auth: Bearer (owner|admin|editor)
  Constraint: Status must be 'running'
  Response: 200 { experiment }  // status → paused

POST   /v1/experiments/:experimentId/stop
  Auth: Bearer (owner|admin|editor)
  Body: { winnerVariantId? }
  Constraint: Status must be 'running' or 'paused'
  Response: 200 { experiment }  // status → stopped, stopped_at set
  Side effect: audit_log, final aggregation triggered

DELETE /v1/experiments/:experimentId
  Auth: Bearer (owner|admin)
  Constraint: Status must be 'draft' or 'stopped'
  Response: 200 { deleted: true }

GET    /v1/experiments/:experimentId/results
  Auth: Bearer (member)
  Response: 200 { results: [{ variant, impressions, conversions, conversionRate, pValue, isSignificant }] }

GET    /v1/experiments/:experimentId/timeseries
  Auth: Bearer (member)
  Query: ?metric=checkout_completed&granularity=hour|day
  Response: 200 { series: [{ timestamp, variantKey, conversionRate }] }
```

### 5.5 SDK Endpoints

```
GET    /sdk/v1/flags
  Auth: X-API-Key
  Query: ?clientSide=true  (filters to client-safe flags only)
  Response: 200 {
    flags: { [key]: FlagConfig },
    experiments: { [key]: ExperimentConfig },
    syncToken: string,
    projectId: string
  }

POST   /sdk/v1/events
  Auth: X-API-Key
  Body: {
    events: [{
      type: 'impression' | 'conversion',
      experimentKey?: string,
      variantKey?: string,
      eventName?: string,
      userId: string,
      properties?: Record<string, unknown>,
      timestamp: string
    }]
  }
  Response: 202 { accepted: number, rejected: number }
  Side effect: Enqueued to BullMQ sdk-events queue

GET    /sdk/v1/health
  Response: 200 { status: 'ok', version: '1.0.0' }
```

### 5.6 SDK Key Endpoints

```
GET    /v1/projects/:projectId/sdk-keys
  Auth: Bearer (member)
  Response: 200 { keys[] }  // key_preview only, never full key

POST   /v1/projects/:projectId/sdk-keys
  Auth: Bearer (owner|admin)
  Body: { name, keyType, environment }
  Response: 201 { key, plaintext }  // plaintext shown ONCE, never stored/returned again
  Constraint: Max 10 active keys per project

DELETE /v1/sdk-keys/:keyId
  Auth: Bearer (owner|admin)
  Response: 200 { revoked: true }
  Side effect: Sets revoked_at, publishes key_revoked to pub/sub → force-disconnect
```

### 5.7 Audit Log Endpoints

```
GET    /v1/workspaces/:workspaceId/audit-logs
  Auth: Bearer (member)
  Query: ?cursor=...&limit=50&actorId=...&resourceType=flag&action=flag.killed
         &from=2026-01-01&to=2026-01-31&resourceKey=new-checkout-flow
  Response: 200 { logs[], pagination: { nextCursor?, hasMore } }
```

### 5.8 WebSocket Protocol (Complete)

**SDK WebSocket — `wss://api.featurevault.io/sdk/v1/sync`**

```
Client → Server:  SUBSCRIBE
  { type: "subscribe", apiKey: "fv_live_...", syncToken: "...", sdkVersion: "1.0.0" }

Server → Client:  SUBSCRIBED (success)
  { type: "subscribed", projectId: "...", flagCount: 42, connectionId: "conn_..." }

Server → Client:  ERROR (auth failed)
  { type: "error", code: "INVALID_API_KEY", message: "..." }

Server → Client:  FLAG UPDATED (pushed on any flag change)
  {
    type: "flag_updated",
    flagKey: "new-checkout-flow",
    flag: { key, type, defaultValue, status, targeting },
    changeType: "created" | "updated" | "killed" | "activated" | "deactivated" | "deleted",
    timestamp: "2026-01-15T10:30:00.000Z"
  }

Server → Client:  FLAG DELETED
  { type: "flag_deleted", flagKey: "new-checkout-flow", timestamp: "..." }

Server → Client:  KEY REVOKED (force-disconnect)
  { type: "key_revoked", message: "API key has been revoked. Disconnecting." }

Client → Server:  PING (every 30s)
  { type: "ping" }

Server → Client:  PONG
  { type: "pong", serverTime: "..." }

Client → Server:  DISCONNECT (graceful)
  { type: "disconnect" }
```

**Dashboard WebSocket — `wss://api.featurevault.io/v1/ws/dashboard`**

Same protocol but authenticated via JWT (sent as query param on initial connection: `?token=eyJ...`), and scoped to the user's workspace. Shows real-time flag changes made by other team members.

---

## Part 6: Code Architecture & Project Structure

### 6.1 Monorepo Structure

```
featurevault/
├── apps/
│   ├── api/                          # Fastify backend
│   │   ├── src/
│   │   │   ├── features/             # Domain modules
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.schema.ts     # Zod schemas
│   │   │   │   │   ├── auth.types.ts
│   │   │   │   │   └── auth.test.ts
│   │   │   │   ├── workspace/
│   │   │   │   │   ├── workspace.routes.ts
│   │   │   │   │   ├── workspace.service.ts
│   │   │   │   │   ├── workspace.schema.ts
│   │   │   │   │   ├── workspace.types.ts
│   │   │   │   │   └── workspace.test.ts
│   │   │   │   ├── project/
│   │   │   │   │   ├── project.routes.ts
│   │   │   │   │   ├── project.service.ts
│   │   │   │   │   ├── project.schema.ts
│   │   │   │   │   ├── project.types.ts
│   │   │   │   │   └── project.test.ts
│   │   │   │   ├── flag/
│   │   │   │   │   ├── flag.routes.ts
│   │   │   │   │   ├── flag.service.ts
│   │   │   │   │   ├── flag.schema.ts
│   │   │   │   │   ├── flag.types.ts
│   │   │   │   │   ├── rule-engine.ts      # Pure functions: evaluateFlag, matchConditions, getBucket
│   │   │   │   │   ├── rule-engine.test.ts  # 100% coverage on this file
│   │   │   │   │   └── flag.test.ts
│   │   │   │   ├── experiment/
│   │   │   │   │   ├── experiment.routes.ts
│   │   │   │   │   ├── experiment.service.ts
│   │   │   │   │   ├── experiment.schema.ts
│   │   │   │   │   ├── experiment.types.ts
│   │   │   │   │   ├── stats.ts             # Welch's t-test, confidence intervals
│   │   │   │   │   ├── stats.test.ts
│   │   │   │   │   └── experiment.test.ts
│   │   │   │   ├── sdk/
│   │   │   │   │   ├── sdk.routes.ts        # /sdk/v1/* endpoints
│   │   │   │   │   ├── sdk.service.ts
│   │   │   │   │   ├── sdk.schema.ts
│   │   │   │   │   └── sdk.test.ts
│   │   │   │   ├── audit-log/
│   │   │   │   │   ├── audit-log.routes.ts
│   │   │   │   │   ├── audit-log.service.ts
│   │   │   │   │   ├── audit-log.schema.ts
│   │   │   │   │   └── audit-log.test.ts
│   │   │   │   └── sdk-key/
│   │   │   │       ├── sdk-key.routes.ts
│   │   │   │       ├── sdk-key.service.ts
│   │   │   │       ├── sdk-key.schema.ts
│   │   │   │       └── sdk-key.test.ts
│   │   │   │
│   │   │   ├── lib/                  # Shared infrastructure
│   │   │   │   ├── db/
│   │   │   │   │   ├── client.ts          # Drizzle + pg pool
│   │   │   │   │   ├── schema.ts          # Drizzle schema definitions
│   │   │   │   │   └── migrations/        # Drizzle migration files
│   │   │   │   ├── redis/
│   │   │   │   │   ├── client.ts          # ioredis singleton
│   │   │   │   │   └── pubsub.ts          # Pub/sub publisher + subscriber
│   │   │   │   ├── queue/
│   │   │   │   │   ├── queue-service.ts   # BullMQ queue definitions
│   │   │   │   │   └── processors/        # Job processor functions
│   │   │   │   │       ├── sdk-events.processor.ts
│   │   │   │   │       ├── email.processor.ts
│   │   │   │   │       ├── aggregation.processor.ts
│   │   │   │   │       └── maintenance.processor.ts
│   │   │   │   ├── ws/
│   │   │   │   │   ├── ws-server.ts       # WebSocket server setup
│   │   │   │   │   ├── sdk-ws.handler.ts  # SDK WebSocket handler
│   │   │   │   │   └── dashboard-ws.handler.ts
│   │   │   │   ├── auth/
│   │   │   │   │   ├── jwt.ts             # RS256 signing + verification
│   │   │   │   │   └── middleware.ts      # Auth + RBAC middleware
│   │   │   │   ├── crypto/
│   │   │   │   │   ├── password.ts        # argon2id hash + verify
│   │   │   │   │   ├── tokens.ts          # Secure random token generation + SHA-256 hashing
│   │   │   │   │   └── hmac.ts            # HMAC for SDK WS auth
│   │   │   │   ├── hashing/
│   │   │   │   │   └── bucket.ts          # MurmurHash3 bucketing (0-100)
│   │   │   │   ├── email/
│   │   │   │   │   ├── email-service.ts   # Nodemailer abstraction
│   │   │   │   │   └── templates/         # Email HTML templates
│   │   │   │   │       ├── verification.ts
│   │   │   │   │       ├── invitation.ts
│   │   │   │   │       ├── password-reset.ts
│   │   │   │   │       └── base.ts        # Shared layout
│   │   │   │   ├── errors/
│   │   │   │   │   ├── app-error.ts       # Base error class
│   │   │   │   │   ├── errors.ts          # NotFoundError, AuthError, etc.
│   │   │   │   │   └── error-handler.ts   # Central error handler (Fastify hook)
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── rate-limit.ts      # Redis sliding window
│   │   │   │   │   ├── cors.ts
│   │   │   │   │   ├── security-headers.ts
│   │   │   │   │   ├── request-id.ts      # X-Request-ID generation
│   │   │   │   │   └── request-logger.ts  # Pino structured logging
│   │   │   │   ├── logger.ts              # Pino configuration
│   │   │   │   └── config.ts             # Environment variable validation (Zod)
│   │   │   │
│   │   │   ├── server.ts              # Fastify app setup + route registration
│   │   │   └── worker.ts             # BullMQ worker entry point
│   │   │
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── drizzle.config.ts
│   │
│   └── web/                          # Next.js frontend
│       ├── src/
│       │   ├── app/                   # App Router pages
│       │   │   ├── (marketing)/
│       │   │   │   ├── page.tsx           # Landing page
│       │   │   │   └── layout.tsx
│       │   │   ├── (auth)/
│       │   │   │   ├── login/page.tsx
│       │   │   │   ├── signup/page.tsx
│       │   │   │   ├── verify-email/page.tsx
│       │   │   │   ├── forgot-password/page.tsx
│       │   │   │   ├── reset-password/[token]/page.tsx
│       │   │   │   └── layout.tsx
│       │   │   ├── (dashboard)/
│       │   │   │   ├── layout.tsx         # Sidebar + WS connection + auth guard
│       │   │   │   └── [workspaceSlug]/
│       │   │   │       ├── page.tsx       # Workspace overview
│       │   │   │       ├── [projectSlug]/
│       │   │   │       │   ├── flags/
│       │   │   │       │   │   ├── page.tsx
│       │   │   │       │   │   ├── [flagKey]/page.tsx
│       │   │   │       │   │   └── new/page.tsx
│       │   │   │       │   ├── experiments/
│       │   │   │       │   │   ├── page.tsx
│       │   │   │       │   │   ├── [experimentKey]/page.tsx
│       │   │   │       │   │   └── new/page.tsx
│       │   │   │       │   └── settings/
│       │   │   │       │       ├── page.tsx
│       │   │   │       │       └── sdk-keys/page.tsx
│       │   │   │       └── settings/
│       │   │   │           ├── page.tsx
│       │   │   │           ├── members/page.tsx
│       │   │   │           └── audit-log/page.tsx
│       │   │   ├── layout.tsx
│       │   │   └── not-found.tsx
│       │   │
│       │   ├── components/
│       │   │   ├── ui/                # shadcn/ui primitives (owned, not imported)
│       │   │   │   ├── button.tsx
│       │   │   │   ├── input.tsx
│       │   │   │   ├── select.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   ├── toast.tsx
│       │   │   │   ├── skeleton.tsx
│       │   │   │   ├── badge.tsx
│       │   │   │   ├── dropdown-menu.tsx
│       │   │   │   └── ... (standard shadcn set)
│       │   │   ├── flags/
│       │   │   │   ├── flag-status-toggle.tsx
│       │   │   │   ├── targeting-rule-builder.tsx
│       │   │   │   ├── rollout-slider.tsx
│       │   │   │   ├── flag-card.tsx
│       │   │   │   ├── flag-list.tsx
│       │   │   │   └── json-flag-editor.tsx
│       │   │   ├── experiments/
│       │   │   │   ├── experiment-builder.tsx
│       │   │   │   ├── experiment-results.tsx
│       │   │   │   ├── variant-editor.tsx
│       │   │   │   └── significance-badge.tsx
│       │   │   ├── layout/
│       │   │   │   ├── workspace-sidebar.tsx
│       │   │   │   ├── top-nav.tsx
│       │   │   │   ├── rbac-gate.tsx
│       │   │   │   └── breadcrumb.tsx
│       │   │   ├── audit/
│       │   │   │   ├── audit-log-table.tsx
│       │   │   │   └── json-diff-viewer.tsx
│       │   │   ├── sdk-keys/
│       │   │   │   ├── sdk-key-card.tsx
│       │   │   │   └── sdk-key-create.tsx
│       │   │   ├── onboarding/
│       │   │   │   └── onboarding-wizard.tsx
│       │   │   └── shared/
│       │   │       ├── empty-state.tsx
│       │   │       ├── error-boundary.tsx
│       │   │       ├── page-header.tsx
│       │   │       └── loading-page.tsx
│       │   │
│       │   ├── stores/               # Zustand stores
│       │   │   ├── auth-store.ts
│       │   │   ├── flag-store.ts
│       │   │   └── ws-store.ts
│       │   │
│       │   ├── hooks/                # Custom React hooks
│       │   │   ├── use-flags.ts          # TanStack Query wrapper
│       │   │   ├── use-flag.ts
│       │   │   ├── use-experiments.ts
│       │   │   ├── use-experiment-results.ts
│       │   │   ├── use-audit-logs.ts
│       │   │   ├── use-sdk-keys.ts
│       │   │   ├── use-members.ts
│       │   │   ├── use-websocket.ts
│       │   │   └── use-rbac.ts           # Role-based UI permission checks
│       │   │
│       │   ├── lib/
│       │   │   ├── api-client.ts         # Fetch wrapper with auth, error handling
│       │   │   ├── ws-client.ts          # Dashboard WebSocket client
│       │   │   └── utils.ts
│       │   │
│       │   └── styles/
│       │       └── globals.css           # Tailwind + design tokens
│       │
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       ├── tailwind.config.ts
│       └── postcss.config.js
│
├── packages/
│   └── sdk/                          # featurevault-node npm package
│       ├── src/
│       │   ├── index.ts              # Public API (FeatureVault class)
│       │   ├── flag-store.ts         # In-memory Map<flagKey, FlagConfig>
│       │   ├── rule-engine.ts        # Pure functions (shared logic with API)
│       │   ├── ws-client.ts          # WebSocket + reconnect logic
│       │   ├── rest-client.ts        # HTTP client for init fetch + event posting
│       │   ├── event-batcher.ts      # Queue + flush logic
│       │   └── types.ts
│       ├── tests/
│       │   ├── flag-store.test.ts
│       │   ├── rule-engine.test.ts
│       │   ├── event-batcher.test.ts
│       │   └── integration.test.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts            # Bundler (ESM + CJS output)
│       └── README.md
│
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml        # Dev overrides (Mailhog, volumes, hot reload)
│   ├── nginx.conf
│   ├── init.sql                      # Initial DB setup (extensions, types)
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── modules/
│           ├── networking/
│           ├── ecs/
│           ├── rds/
│           ├── elasticache/
│           ├── alb/
│           ├── acm/
│           ├── ecr/
│           ├── secrets/
│           ├── cloudwatch/
│           └── s3/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint + type check + test
│       ├── deploy.yml                # Build + push + deploy to ECS
│       └── sdk-publish.yml           # Publish featurevault-node to npm
│
├── CLAUDE.md                         # AI constitution (see Part 8)
├── .env.example
├── .gitignore
├── package.json                      # Root (npm workspaces)
├── turbo.json                        # Turborepo config
└── README.md
```

### 6.2 Service Layer Pattern (Enforced Everywhere)

**The iron rule: Routes handle HTTP. Services contain logic. No exceptions.**

```
Route Handler                    Service                        Database
┌─────────────┐                ┌───────────────┐              ┌──────────┐
│             │                │               │              │          │
│ 1. Parse    │                │ 3. Business   │              │          │
│    request  │───validate────►│    logic      │──query/──────►│ Postgres │
│             │    (Zod)       │               │  write        │          │
│ 2. Validate │                │ 4. Orchestrate│              │          │
│    input    │                │    side       │──cache────────►│ Redis    │
│             │                │    effects    │              │          │
│ 5. Format   │◄──return───── │               │──publish──────►│ Pub/Sub  │
│    response │    result     │               │              │          │
│             │                │               │──enqueue─────►│ BullMQ   │
└─────────────┘                └───────────────┘              └──────────┘
```

**What goes where:**

| Layer | Responsibilities | Does NOT do |
|---|---|---|
| **Route** (`*.routes.ts`) | Parse req params/body/query, call Zod validate, call service, format HTTP response (status code, envelope), handle pagination params | Business logic, DB queries, cache ops, authorization checks beyond middleware |
| **Service** (`*.service.ts`) | Business logic, data validation rules, orchestrate DB writes + cache invalidation + pub/sub + audit log creation, throw AppError on business rule violations | Parse HTTP requests, set status codes, know about Express/Fastify, return HTTP responses |
| **Schema** (`*.schema.ts`) | Zod schemas for request validation, response shapes, shared type inference | Logic, side effects |
| **Types** (`*.types.ts`) | TypeScript interfaces/types inferred from Zod or manually defined | Logic, side effects |

### 6.3 Error Handling Architecture

```typescript
// Base error class
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Specific error subclasses
class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super(404, `${resource.toUpperCase()}_NOT_FOUND`, `${resource} '${identifier}' not found`);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'AUTHENTICATION_REQUIRED', message);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, 'INSUFFICIENT_PERMISSIONS', message);
  }
}

class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(400, 'VALIDATION_ERROR', message, field);
  }
}

class ConflictError extends AppError {
  constructor(resource: string, field: string, value: string) {
    super(409, `${resource.toUpperCase()}_${field.toUpperCase()}_ALREADY_EXISTS`,
      `A ${resource} with ${field} '${value}' already exists`, field);
  }
}

class RateLimitError extends AppError {
  constructor(public retryAfter: number) {
    super(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests');
  }
}
```

**Central error handler (Fastify `setErrorHandler`):**
- Catches all thrown errors
- If `AppError`: returns structured error response with correct status code
- If `ZodError`: transforms to 400 with field-level errors
- If unknown error: logs full stack trace, returns generic 500 to client (never leak internals)
- All errors include `requestId` in response

### 6.4 Logging Strategy

**Logger: Pino (Fastify's default, fastest Node.js logger)**

```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'refreshToken', 'apiKey'],
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      requestId: req.id,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
```

**What gets logged:**

| Event | Level | Fields |
|---|---|---|
| Incoming request | `info` | method, url, requestId |
| Response sent | `info` | method, url, statusCode, responseTime, requestId |
| Business event (flag created, experiment launched) | `info` | action, resourceType, resourceId, actorId, requestId |
| Validation error | `warn` | code, message, field, requestId |
| Auth failure | `warn` | code, email (hashed), ip, requestId |
| Rate limit hit | `warn` | key, limit, current, requestId |
| Unhandled error | `error` | message, stack, requestId |
| DB query slow (>200ms) | `warn` | query (truncated), duration, requestId |
| Worker job failed | `error` | queue, jobId, error, attempt |
| Worker job completed | `debug` | queue, jobId, duration |
| WebSocket connection | `info` | connectionId, projectId, sdkVersion |
| WebSocket disconnect | `info` | connectionId, reason |

**Never logged:** Passwords, tokens (refresh, verification, reset), full API keys, PII beyond email.

---

## Part 7: Design System & Visual Direction

### 7.1 Design Brief

**Brand personality (3 adjectives):** Precise, Trustworthy, Technical

**Aesthetic direction:** Developer-tool refined. Think Linear meets Vercel — clean, information-dense where it matters, generous whitespace everywhere else. Dark mode primary (developers live in dark mode). No flashy gradients, no purple-blue AI slop. A single sharp accent color against muted surfaces.

**Design variance:** 5/10 (confident but clean — not experimental, not boring)
**Motion intensity:** 5/10 (purposeful transitions, not decorative)
**Visual density:** 6/10 (dashboard is data-dense, marketing is spacious)

### 7.2 Design Tokens

```css
/* ──────────────────────────────────────
   COLOR SYSTEM
   ────────────────────────────────────── */

:root {
  /* Accent: Emerald green (not the typical blue/purple) */
  --color-accent-50: #ecfdf5;
  --color-accent-100: #d1fae5;
  --color-accent-200: #a7f3d0;
  --color-accent-300: #6ee7b7;
  --color-accent-400: #34d399;
  --color-accent-500: #10b981;   /* Primary accent */
  --color-accent-600: #059669;
  --color-accent-700: #047857;
  --color-accent-800: #065f46;
  --color-accent-900: #064e3b;

  /* Danger: Red for destructive actions, kill switches */
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;

  /* Warning: Amber for caution states */
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;

  /* Surfaces (dark mode primary) */
  --color-bg-primary: #0a0a0a;       /* Page background */
  --color-bg-secondary: #111111;      /* Card backgrounds */
  --color-bg-tertiary: #1a1a1a;       /* Input backgrounds, hover states */
  --color-bg-elevated: #222222;       /* Modals, dropdowns */

  /* Borders */
  --color-border-subtle: #1f1f1f;     /* Card borders, dividers */
  --color-border-default: #2a2a2a;    /* Input borders */
  --color-border-strong: #404040;     /* Focus rings */

  /* Text */
  --color-text-primary: #fafafa;      /* Primary text */
  --color-text-secondary: #a1a1aa;    /* Secondary/muted text */
  --color-text-tertiary: #71717a;     /* Placeholder, disabled */
  --color-text-inverse: #0a0a0a;      /* Text on accent backgrounds */
}

/* Light mode overrides (toggled via data attribute) */
[data-theme="light"] {
  --color-bg-primary: #fafafa;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #f4f4f5;
  --color-bg-elevated: #ffffff;
  --color-border-subtle: #e4e4e7;
  --color-border-default: #d4d4d8;
  --color-border-strong: #a1a1aa;
  --color-text-primary: #18181b;
  --color-text-secondary: #52525b;
  --color-text-tertiary: #a1a1aa;
}

/* ──────────────────────────────────────
   TYPOGRAPHY
   ────────────────────────────────────── */

:root {
  /* Font families */
  --font-display: 'Cabinet Grotesk', sans-serif;     /* Headlines, hero text */
  --font-body: 'Satoshi', sans-serif;                /* Body text, UI */
  --font-mono: 'JetBrains Mono', monospace;          /* Code, keys, metrics */

  /* Font sizes (modular scale, ratio 1.25) */
  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */
  --text-5xl: 3rem;        /* 48px */

  /* Line heights */
  --leading-tight: 1.1;
  --leading-snug: 1.3;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  /* Letter spacing */
  --tracking-tighter: -0.04em;  /* Headlines */
  --tracking-tight: -0.02em;    /* Subheadings */
  --tracking-normal: 0;          /* Body */
  --tracking-wide: 0.02em;       /* Labels, badges */
}

/* ──────────────────────────────────────
   SPACING SCALE
   ────────────────────────────────────── */

:root {
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
}

/* ──────────────────────────────────────
   BORDER RADIUS
   ────────────────────────────────────── */

:root {
  --radius-sm: 4px;     /* Badges, small elements */
  --radius-md: 8px;     /* Buttons, inputs */
  --radius-lg: 12px;    /* Cards */
  --radius-xl: 16px;    /* Modals */
  --radius-full: 9999px; /* Avatars, pills */
}

/* ──────────────────────────────────────
   SHADOWS (tinted, not pure black)
   ────────────────────────────────────── */

:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.5);
}

/* ──────────────────────────────────────
   Z-INDEX SCALE (no z-9999 chaos)
   ────────────────────────────────────── */

:root {
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-overlay: 30;
  --z-modal: 40;
  --z-toast: 50;
}

/* ──────────────────────────────────────
   TRANSITIONS
   ────────────────────────────────────── */

:root {
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 7.3 Component Checklist (Build Before Features)

These are built ONCE as the design system foundation, then every feature screen composes from them:

| Component | Variants | States |
|---|---|---|
| `Button` | primary (accent), secondary (outline), ghost, danger | default, hover, active, loading, disabled |
| `Input` | text, email, password (with show/hide), search | default, focus, error, disabled |
| `Select` | single-select dropdown | default, open, focus, error |
| `Textarea` | standard | default, focus, error |
| `Dialog/Modal` | standard, destructive confirmation | open, closed (with animation) |
| `Toast` | success, error, warning, info | enter, exit (with animation) |
| `Badge` | default, success, warning, danger, info | static |
| `Skeleton` | text line, card, table row, circle | loading pulse animation |
| `EmptyState` | illustration + CTA | static |
| `ErrorState` | message + retry button | static |
| `DataTable` | with sorting, filtering, pagination | loading, empty, populated |
| `Dropdown Menu` | standard, with icons, with sections | open, closed |
| `Toggle/Switch` | on/off with animation | on, off, loading, disabled |
| `Tooltip` | text-only | show, hide |
| `Breadcrumb` | with separator, workspace/project context | static |
| `Avatar` | image, initials fallback | squircle shape (NOT circle) |
| `CodeBlock` | with copy button, syntax highlighting | static |
| `KeyDisplay` | blurred until clicked, copy-to-clipboard | hidden, revealed, copied |

### 7.4 Iconography

**Decision: Phosphor Icons (Bold weight)**

Not Lucide (AI default), not Feather (dated). Phosphor has a comprehensive set, consistent stroke weights, and a distinctive look.

Key icon mappings:
| Concept | Icon | NOT |
|---|---|---|
| Feature flag | `Flag` | Shield |
| Kill switch | `Lightning` (or `Power`) | Skull |
| Experiment | `Flask` | Beaker |
| Deploy/Launch | `Rocket` (allowed here, it's literal) | — |
| Security/Auth | `Fingerprint` | Shield |
| Workspace | `Buildings` | Briefcase |
| Settings | `GearSix` | Wrench |
| Audit log | `ClockCounterClockwise` | History |
| SDK key | `Key` | Lock |
| User/Member | `User` | Person |
| Danger/Delete | `Trash` | X |
| Success | `CheckCircle` | Checkmark |
| Copy | `Copy` | Clipboard |

---

## Part 8: CLAUDE.md (AI Constitution)

This file lives at the repo root and is read by Claude/Cursor before every generation.

```markdown
# CLAUDE.md — FeatureVault AI Constitution

## Project
FeatureVault: Self-hostable feature flag + A/B testing platform.

## Tech Stack (exact versions)
- Backend: Node.js 22, Fastify 5, TypeScript 5.5, Drizzle ORM, PostgreSQL 16, Redis 7 (ioredis), BullMQ 5
- Frontend: Next.js 15 (App Router), TypeScript 5.5, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query 5, Recharts, Phosphor Icons
- SDK: TypeScript, tsup (ESM + CJS), MurmurHash3
- Testing: Vitest, Supertest
- Infrastructure: Docker, Docker Compose, GitHub Actions, Terraform (AWS)

## Architecture Rules
1. MODULAR MONOLITH. Code organized by domain: src/features/{domain}/
2. Each domain has: routes.ts, service.ts, schema.ts, types.ts, *.test.ts
3. NEVER write DB queries inside route handlers. Routes call services. Services call DB.
4. NEVER import from one feature into another feature's internal files. Use the service's public API.
5. ALL shared utilities go in src/lib/
6. NEVER use console.log. Use the Pino logger imported from src/lib/logger.ts
7. NEVER use any/unknown without explicit justification comment.

## Code Patterns (REQUIRED)
1. All input validation uses Zod schemas defined in *.schema.ts
2. All errors are thrown as AppError subclasses (from src/lib/errors/)
3. All async route handlers wrapped with error boundary (Fastify handles this)
4. All DB writes that modify user-facing state MUST create an audit log entry
5. All flag/experiment changes MUST invalidate Redis cache AND publish to pub/sub
6. All passwords hashed with argon2id (NEVER bcrypt)
7. All tokens (verification, reset, invite) stored as SHA-256 hashes, NEVER plaintext
8. All SDK keys stored as SHA-256 hashes after one-time display
9. All API responses use the standard envelope: { success, data, meta } or { success, error, meta }
10. All list endpoints use pagination (offset for small lists, cursor for large/append-only)

## Naming Conventions
- Files: kebab-case (auth.routes.ts, flag.service.ts)
- Variables/functions: camelCase
- Types/interfaces: PascalCase
- Database columns: snake_case
- API response fields: camelCase
- Environment variables: SCREAMING_SNAKE_CASE
- CSS variables: kebab-case with -- prefix

## Testing Requirements
- Every service function has a test
- Every route has integration tests (Supertest)
- Rule engine (flag evaluation, MurmurHash bucketing) has 100% coverage
- Stats functions (Welch's t-test) have 100% coverage
- Test files co-located with source files (auth.test.ts next to auth.service.ts)

## Things to NEVER Do
- NEVER use `any` type
- NEVER use `console.log` (use logger)
- NEVER write raw SQL strings (use Drizzle query builder)
- NEVER store secrets in code (use process.env via config.ts)
- NEVER spread req.body into DB queries (explicit field picks only)
- NEVER return stack traces to the client
- NEVER log passwords, tokens, or full API keys
- NEVER use synchronous file I/O
- NEVER use var (use const/let)
- NEVER commit .env files (only .env.example)
- NEVER use `==` (use `===`)
- NEVER use Lucide icons (use Phosphor)
- NEVER use Inter/Roboto fonts
```

---

## Part 9: Infrastructure & Deployment

### 9.1 Docker Compose (Development)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    environment:
      POSTGRES_DB: featurevault
      POSTGRES_USER: fv_user
      POSTGRES_PASSWORD: fv_dev_password_123
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fv_user -d featurevault"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass fv_dev_redis_123 --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "fv_dev_redis_123", "ping"]
      interval: 5s

  mailhog:
    image: mailhog/mailhog
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI (view sent emails)

volumes:
  postgres_data:
```

### 9.2 Environment Variables

```bash
# .env.example — ALL keys documented, NO values

# ─── Server ───
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:3000

# ─── Database ───
DATABASE_URL=postgresql://fv_user:fv_dev_password_123@localhost:5432/featurevault

# ─── Redis ───
REDIS_URL=redis://:fv_dev_redis_123@localhost:6379

# ─── JWT (RS256) ───
# Generate with: openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
# Then: openssl rsa -pubout -in private.pem -out public.pem
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TTL=900          # 15 minutes in seconds
JWT_REFRESH_TTL=604800      # 7 days in seconds

# ─── Email ───
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@featurevault.io

# ─── CORS ───
ALLOWED_ORIGINS=http://localhost:3000

# ─── Logging ───
LOG_LEVEL=debug
```

### 9.3 Config Validation (Zod at startup)

```typescript
// src/lib/config.ts
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().url(),
  WEB_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_PRIVATE_KEY_PATH: z.string().min(1),
  JWT_PUBLIC_KEY_PATH: z.string().min(1),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(604800),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().email(),
  ALLOWED_ORIGINS: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// Validated once at startup — crashes immediately if any env var is missing/invalid
export const config = configSchema.parse(process.env);
```

### 9.4 GitHub Actions CI Pipeline

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint          # ESLint
      - run: npm run typecheck     # tsc --noEmit
      - run: npm run format:check  # Prettier check

  test-api:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: fv_test
          POSTGRES_USER: fv_user
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
        ports:
          - 6379:6379
    env:
      NODE_ENV: test
      DATABASE_URL: postgresql://fv_user:test_password@localhost:5432/fv_test
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run db:migrate --workspace=apps/api
      - run: npm run test:coverage --workspace=apps/api

  test-sdk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test --workspace=packages/sdk

  test-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test --workspace=apps/web
```

---

## Part 10: Build Sequence (Phase-by-Phase)

### Phase 1: Foundation (Week 1-2)

**Goal: Database up, auth working, infrastructure solid. No features yet.**

```
Day 1-2: Project Scaffold
  ├── Initialize monorepo (npm workspaces + Turborepo)
  ├── TypeScript configs (root, api, web, sdk)
  ├── ESLint + Prettier config
  ├── Docker Compose (Postgres + Redis + Mailhog)
  ├── Drizzle ORM setup + schema file
  ├── Run all migrations (create all tables from Part 3)
  ├── Pino logger setup
  ├── Config validation (Zod + process.env)
  ├── CLAUDE.md in repo root
  └── .env.example with all keys

Day 3-4: Error Handling + Middleware
  ├── AppError class hierarchy
  ├── Central error handler
  ├── Request ID middleware (X-Request-ID)
  ├── CORS middleware
  ├── Security headers middleware
  ├── Rate limiting middleware (Redis sliding window)
  ├── Request logging middleware (Pino)
  └── Health check endpoint (/health)

Day 5-7: Auth Module
  ├── Password hashing (argon2id)
  ├── Token generation + SHA-256 hashing
  ├── RS256 JWT setup (key pair generation, sign, verify)
  ├── POST /auth/signup (+ workspace + default project creation)
  ├── POST /auth/login (+ rate limiting)
  ├── POST /auth/refresh (+ token rotation + replay detection)
  ├── POST /auth/logout
  ├── POST /auth/verify-email
  ├── POST /auth/forgot-password + POST /auth/reset-password
  ├── GET /auth/me
  ├── Auth middleware (JWT verification)
  ├── RBAC middleware (permission checks)
  ├── BullMQ setup + email processor
  ├── Email templates (verification, password reset)
  └── Tests for all auth flows

Day 8-10: Workspace + Project + SDK Keys
  ├── Workspace CRUD
  ├── Member management (invite, role change, remove)
  ├── Invitation flow (send email, accept link)
  ├── Workspace middleware (extract from URL, check membership)
  ├── Project CRUD
  ├── SDK key generation (fv_live_/fv_test_ + SHA-256 storage)
  ├── SDK key authentication middleware
  └── Tests for all workspace/project/key flows
```

**Deliverable:** A running API where you can sign up, log in, create workspaces/projects, generate SDK keys. All testable via HTTP client (Bruno/Postman). Zero UI yet.

### Phase 2: Core Flag Engine (Week 3-4)

**Goal: Feature flags working end-to-end, including real-time propagation.**

```
Day 11-13: Flag CRUD + Rule Engine
  ├── Flag CRUD API (create, read, update, delete, list)
  ├── Targeting rule CRUD (embedded in flag update)
  ├── Flag versioning (snapshot on every write)
  ├── MurmurHash3 bucketing function (pure, tested)
  ├── Rule engine: evaluateFlag(flag, userContext) → value
  ├── Rule engine: matchesConditions(conditions, attributes) → boolean
  ├── Rule engine: getBucket(userId, flagKey) → 0-100
  ├── 100% test coverage on rule engine
  └── Audit log writes on every flag mutation

Day 14-16: Redis Cache + Pub/Sub + WebSocket
  ├── Redis flag cache (store/invalidate on write)
  ├── Redis pub/sub publisher (fires on flag change)
  ├── WebSocket server setup (@fastify/websocket)
  ├── SDK WebSocket handler (subscribe, push updates, heartbeat)
  ├── Dashboard WebSocket handler (JWT auth, flag change feed)
  ├── Redis pub/sub subscriber → push to local WS connections
  ├── SDK API: GET /sdk/v1/flags (full flag config fetch)
  └── Integration test: change flag → SDK receives update <100ms

Day 17-19: SDK Package
  ├── FeatureVault class (public API)
  ├── FlagStore (in-memory Map)
  ├── RestClient (fetch flags on connect)
  ├── WebSocketClient (subscribe, handle updates, reconnect)
  ├── RuleEngine (shared logic with API)
  ├── EventBatcher (queue + timer + flush)
  ├── vault.isEnabled() / getStringFlag() / getNumberFlag() / getJSONFlag()
  ├── vault.getVariant() (experiment assignment)
  ├── vault.track() (event tracking)
  ├── vault.connect() / vault.close()
  ├── Unit tests for all SDK components
  ├── Integration test with live API
  ├── tsup build config (ESM + CJS)
  ├── package.json with proper exports field
  └── README with usage examples
```

**Deliverable:** Full flag lifecycle working. SDK can connect, evaluate flags locally, receive real-time updates. npm package ready (not published yet).

### Phase 3: Experiments + Analytics (Week 5-6)

**Goal: A/B testing pipeline, stats engine, and the dashboard UI.**

```
Day 20-22: Experiment Engine
  ├── Experiment CRUD API
  ├── Variant assignment in SDK (MurmurHash3)
  ├── vault.track() → POST /sdk/v1/events (batched)
  ├── BullMQ worker: sdk-events processor
  ├── Write impressions + events to partitioned tables
  ├── Welch's t-test implementation (pure function)
  ├── Power analysis for sample size calculation
  ├── BullMQ scheduled job: hourly aggregation
  ├── Experiment results API (current + time series)
  └── Tests for stats functions (100% coverage)

Day 23-28: Dashboard UI (Next.js)
  ├── Design system components (Button, Input, Dialog, Toast, etc.)
  ├── Auth pages (login, signup, verify email, forgot/reset password)
  ├── Dashboard layout (sidebar, top nav, WS connection)
  ├── Onboarding wizard (workspace setup, project creation, SDK key)
  ├── Flags list page (search, filter, sort)
  ├── Flag detail page (targeting rule builder, rollout slider)
  ├── Flag status toggle (with propagation indicator)
  ├── Experiments list page
  ├── Experiment builder (multi-step wizard)
  ├── Experiment results page (Recharts graphs, significance badge)
  ├── Audit log page (virtual scroll, JSON diff viewer)
  ├── SDK key management page
  ├── Team management page (invite, role change)
  ├── Workspace settings
  ├── RBAC gates (hide create buttons for viewers)
  ├── Zustand stores (auth, flag, ws)
  ├── TanStack Query hooks
  ├── Dashboard WebSocket client (real-time flag feed)
  └── Empty states, loading skeletons, error states
```

**Deliverable:** Fully functional dashboard. A/B experiment lifecycle working. SDK published to npm.

### Phase 4: Polish + Deploy (Week 7-8)

**Goal: Production-hardened, live on the internet, demo-ready.**

```
Day 29-31: Security Hardening + Testing
  ├── CSP headers verified
  ├── CSRF token implementation
  ├── Input sanitization audit
  ├── SQL injection test suite
  ├── Rate limit testing (all endpoints)
  ├── Auth security tests (replay attack, brute force)
  ├── RBAC permission matrix test
  ├── k6 load test (flag evaluation throughput)
  └── Accessibility audit (keyboard nav, ARIA, contrast)

Day 32-34: Infrastructure + Deployment
  ├── Multi-stage Dockerfiles (API + Web)
  ├── Docker Compose production config
  ├── Terraform modules (VPC, ECS, RDS, ElastiCache, ALB, ACM)
  ├── GitHub Actions deploy pipeline
  ├── Secrets Manager setup
  ├── CloudWatch log groups + alarms
  ├── Domain setup + SSL certificate
  └── Smoke tests in CI pipeline

Day 35-37: Marketing + Documentation
  ├── Landing page (marketing site)
  ├── README: architecture diagram, quickstart, SDK docs
  ├── API documentation (auto-generated from Zod schemas)
  ├── SDK README with code examples
  ├── Record Loom demo video
  ├── GitHub repo polish (badges, contributing guide)
  └── npm SDK publish
```

**Deliverable:** Live on AWS. Public demo. npm package published. README with architecture diagrams. Video walkthrough recorded.

---

## Part 11: Performance Benchmarks (What We'll Measure)

| Metric | Target | How |
|---|---|---|
| SDK flag evaluation | < 0.1ms p99 | k6 local benchmark, no network |
| Flag propagation (change → SDK receives) | < 100ms p95 | Instrumented integration test |
| REST API reads | < 50ms p95 | k6 against deployed API |
| REST API writes | < 200ms p95 | k6 against deployed API |
| SDK init fetch (/sdk/v1/flags) | < 300ms p95 | k6 |
| Dashboard LCP | < 2.5s | Lighthouse CI |
| Event batch processing lag | < 30s p99 | BullMQ timing metrics |
| MurmurHash distribution accuracy | ±2% at any rollout % | Unit test with 100k users |
| Docker image size (API) | < 150MB | `docker images` |
| Cold start to first request | < 3s | Measured in CI |

---

## Part 12: Open Decisions (Locked)

These were open questions in the PRD. Here are the final decisions:

| Question | Decision | Rationale |
|---|---|---|
| Targeting attribute validation | Client-defined, no server validation | SDK sends arbitrary attributes. Server never sees user context at flag evaluation time (evaluation is local). Server only stores the rule definitions. |
| Flag deletion behavior | Soft delete. `deleted_at` column. Purged after 30 days. | Preserves audit history. Users can undo mistakes. Maintenance job handles permanent deletion. |
| SDK offline behavior | Serve last-known cached values from memory | Never serve null/empty. If SDK loses connection, flags continue evaluating against the last known config. This is documented behavior. |
| Experiment assignment stickiness | Deterministic via MurmurHash3 on `(userId + experimentKey)` | Same user always gets same variant. No sticky session storage needed. Works across restarts, scaling, even SDK reinstallation. |
| Pagination default limit | 20 for lists, 50 for audit logs | Balances data transfer with usability |
| Max flags per project (free tier) | 100 | Generous enough for real use, prevents abuse |
| Max experiments per project | 50 | Same logic |
| Max SDK keys per project | 10 | Production + staging + development × server-side + client-side = 6 minimum needed |
| Max targeting rules per flag | 10 | Prevents overly complex rule chains that are hard to debug |
| Max variants per experiment | 5 | Sufficient for any reasonable A/B/n test |
| Audit log retention | 90 days | Balances storage cost with compliance needs |
| Session duration | 7 days (refresh token), 15 min (access token) | Standard security practice |
| Password requirements | Min 12 chars, 1 uppercase, 1 number, 1 special | OWASP 2024 recommendations |
| Workspace slug format | `[a-z0-9][a-z0-9-]*`, 3-100 chars | URL-safe, human-readable |
| Flag key format | `[a-z0-9][a-z0-9-_]*`, 1-128 chars | Same, plus underscore allowed |

---

*This document is the single source of truth. Every line of code we write must be traceable back to a decision made here. If a decision isn't in this document, we discuss it first, add it here, then build it.*

*Let's build.*
