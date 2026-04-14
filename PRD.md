# FeatureVault — Product Requirements Document

**Version:** 1.0.0  
**Author:** Nikhil  
**Status:** In Review  
**Last Updated:** 2026  
**Document Type:** Engineering PRD (Production-Grade)

---

## Table of Contents

1. [High-Level Vision](#1-high-level-vision)
2. [Functional Requirements](#2-functional-requirements)
3. [User Flows](#3-user-flows)
4. [Technical Specifications](#4-technical-specifications)
5. [Data Architecture & Schema](#5-data-architecture--schema)
6. [API Design](#6-api-design)
7. [SDK Design](#7-sdk-design)
8. [Frontend Architecture & Components](#8-frontend-architecture--components)
9. [Infrastructure & Deployment](#9-infrastructure--deployment)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Security Architecture](#11-security-architecture)
12. [Observability & Monitoring](#12-observability--monitoring)
13. [Success Metrics](#13-success-metrics)
14. [Build Timeline](#14-build-timeline)
15. [Risks & Open Questions](#15-risks--open-questions)
16. [Gherkin Scenarios (Agent-Ready Tests)](#16-gherkin-scenarios)

---

## 1. High-Level Vision

### 1.1 Executive Summary

FeatureVault is a self-hostable, developer-first feature flag and A/B testing platform that lets engineering teams safely ship code by decoupling deployments from releases. Unlike existing solutions, FeatureVault's SDK evaluates flags at sub-millisecond latency by maintaining a local in-memory store that stays in sync with the server via a persistent WebSocket subscription — zero network calls per flag check, ever. Teams can ship 10x faster, roll back instantly, and run statistically rigorous A/B experiments without paying LaunchDarkly's enterprise pricing.

### 1.2 Problem Statement

Feature flag management in 2026 is either too expensive or too primitive:

- **LaunchDarkly** charges $20+/seat/month, is a black box, and is overkill for early-stage teams.
- **Open-source alternatives** (Unleash, Flagsmith, GrowthBook) have poor DX, weak SDKs, no real-time propagation, and require serious DevOps effort to self-host properly.
- **Home-grown solutions** (`if (process.env.NEW_FEATURE === 'true')`) don't scale, have no targeting rules, no audit history, no rollback UI, and no A/B analytics.
- **The core technical problem no one has solved for self-hosters:** Every flag evaluation that requires a network call adds 10–200ms per check. At 50 flag checks per request, that's 1–10 seconds of pure overhead. FeatureVault eliminates this entirely.

Teams are shipping broken code to 100% of users, running manual one-shot experiments, and have no incident response for bad feature releases. FeatureVault fixes all three.

### 1.3 Target Audience

**Persona 1: "The Startup CTO" — Arjun, 28**
- 3-person engineering team, SaaS product, 2,000 MAU
- Wants to ship fast without burning users on broken features
- Will not pay $500/month for LaunchDarkly; has a $50/month infra budget
- Technical enough to run a Docker Compose file; doesn't want to maintain infra
- Pain: Rolled a bad payment feature to 100% of users last week, 3-hour outage

**Persona 2: "The Senior Backend Engineer" — Priya, 26**
- Works at a 30-person product company
- Responsible for the release process, sick of feature branches causing merge conflicts
- Wants to gate features behind user segments (beta users, enterprise accounts)
- Pain: Has to hotfix and re-deploy to disable a bad feature; no rollback button

**Persona 3: "The Growth PM" — Rohan, 31**
- Runs A/B experiments to optimize conversion
- Currently uses Optimizely ($2,000+/month) just for one experiment at a time
- Wants statistical significance tracking without a data science team
- Pain: Doesn't know if his "new checkout button" is actually working or just noise

**Persona 4: "The Platform Engineer" — Kavya, 29**
- Manages shared infra for 10+ internal services
- Wants one centralized feature flag service all teams plug into
- Needs RBAC (devs can create flags, only admins can force-enable production flags)
- Pain: Every team has their own env-var-based config system, total chaos

### 1.4 Goals & Non-Goals

**V1.0 Goals:**
- Full feature flag CRUD with targeting rules (user ID, email, custom attributes, percentage rollout)
- A/B experiment management with variant assignment and conversion tracking
- Real-time flag propagation to SDK instances (sub-100ms end-to-end)
- Published `featurevault-node` npm SDK with zero-network-call evaluation
- Dashboard with live analytics (impressions, conversions, statistical significance)
- Multi-workspace, multi-project, role-based access control
- Audit log for every flag change
- Self-hostable via Docker Compose in under 5 minutes
- Full REST API with SDK API keys
- Rate limiting, auth hardening, and basic DDOS protection

**V1.0 Non-Goals (explicitly deferred to V2+):**
- SDKs for Python, Go, Java, Ruby (V1 is Node.js only; others in V2)
- Billing / subscription management (V1 is fully open-source)
- Multi-region deployments / global edge evaluation
- Mutual TLS between services
- SSO (SAML, OKTA, Azure AD) — V2 Enterprise feature
- Mobile SDKs (React Native, Flutter)
- Git-based flag config (GitOps workflow)
- Slack / PagerDuty / Opsgenie integrations
- AI-powered flag suggestions (deferred, not V1 scope)
- Scheduled flag activation/deactivation (cron-based)

---

## 2. Functional Requirements

### 2.1 Authentication & Identity Module

**US-AUTH-01:** As a new user, I want to sign up with my email and password so that I can create my workspace.

**Acceptance Criteria:**
- Email must be valid format, password minimum 12 characters, 1 uppercase, 1 number, 1 special character
- Password stored as Argon2id hash (not bcrypt — Argon2id is the 2026 standard)
- On signup, a default workspace is created with the user as `OWNER`
- Email verification required before accessing dashboard (token expires in 24h)
- Signup returns a 201 with `{ userId, workspaceId }` — never returns the token directly (anti-enumeration)

**US-AUTH-02:** As a returning user, I want to log in with email/password and receive a short-lived JWT so that I can access the dashboard securely.

**Acceptance Criteria:**
- Returns `accessToken` (15 min TTL) in response body + `refreshToken` (7 days TTL) as `HttpOnly, Secure, SameSite=Strict` cookie
- Max 5 failed login attempts per email per 15-minute window (Redis-backed, returns 429 with retry-after header)
- Successful login creates a `sessions` record with IP, user-agent, and last-seen timestamp
- Login response time < 200ms at p95

**US-AUTH-03:** As a logged-in user, I want my session to silently refresh before my access token expires so that I don't get logged out mid-session.

**Acceptance Criteria:**
- Frontend proactively calls `/auth/refresh` when access token has < 2 minutes remaining
- Refresh rotates the refresh token (single-use, stored hashed in DB)
- If refresh token is reused (replay attack), all sessions for that user are immediately invalidated

---

### 2.2 Workspace & Project Module

**US-WS-01:** As an owner, I want to create multiple projects within my workspace so that I can separate flags across different products or environments.

**Acceptance Criteria:**
- Workspace has a unique slug (e.g., `acme-corp`) used for routing and API key scoping
- Projects are logical namespaces within a workspace (e.g., `web-app`, `mobile-api`, `internal-tools`)
- Each project gets its own set of SDK keys
- Default project auto-created on workspace creation

**US-WS-02:** As an owner, I want to invite team members by email with role-based access so that different engineers have appropriate permissions.

**Roles (RBAC Model):**
| Role | Permissions |
|---|---|
| `OWNER` | Full access. Transfer ownership. Delete workspace. Manage billing. |
| `ADMIN` | Full access except delete workspace. Can force-enable flags in production. |
| `EDITOR` | Create/edit/delete flags and experiments. Cannot force-enable in production. |
| `VIEWER` | Read-only access to all flags, experiments, and analytics. |

**Acceptance Criteria:**
- Invitation email sent with magic link (expires 48h)
- Invited user must have or create an account before joining
- Role changes take effect immediately (reflected in next JWT or middleware check)
- Owners can transfer workspace ownership (requires confirmation email)

---

### 2.3 Feature Flag Module

**US-FF-01:** As an editor, I want to create a feature flag with a targeting rule so that I can gradually roll out a feature to a subset of users.

**Flag Structure:**
```json
{
  "key": "new-checkout-flow",
  "name": "New Checkout Flow",
  "description": "Redesigned checkout with Stripe Payment Element",
  "type": "boolean",
  "defaultValue": false,
  "status": "active",
  "targeting": {
    "enabled": true,
    "rules": [
      {
        "id": "rule-001",
        "name": "Beta users",
        "conditions": [
          { "attribute": "plan", "operator": "in", "value": ["beta", "enterprise"] }
        ],
        "serve": true,
        "rolloutPercentage": 100
      },
      {
        "id": "rule-002",
        "name": "10% of everyone else",
        "conditions": [],
        "serve": true,
        "rolloutPercentage": 10
      }
    ],
    "defaultRule": { "serve": false }
  }
}
```

**Flag Types (V1):**
- `boolean` — true/false (most common)
- `string` — return different string values per segment
- `number` — numeric value (e.g., for timeouts, rate limits, thresholds)
- `json` — return a JSON object (e.g., for UI config, copy variants)

**Targeting Operators:**
| Operator | Applicable to |
|---|---|
| `equals` / `not_equals` | string, number |
| `contains` / `not_contains` | string |
| `in` / `not_in` | string, number (list match) |
| `greater_than` / `less_than` | number |
| `matches_regex` | string |
| `is_true` / `is_false` | boolean |

**Rollout Mechanism:** MurmurHash3 on `(userId + flagKey)` → normalize to 0–100 → compare to `rolloutPercentage`. Same user always gets the same outcome regardless of server restart or horizontal scaling. No sticky sessions required.

**Acceptance Criteria:**
- Flag key must be URL-safe (`[a-z0-9-_]`, max 128 chars), unique within project
- Up to 10 targeting rules per flag in V1
- Rule evaluation is top-down; first matching rule wins
- Changing a flag broadcasts update to all connected SDK instances within 100ms via WebSocket
- Every flag change creates an immutable `audit_log` entry with before/after state, actor, and timestamp
- Flags support tags (max 10 per flag) for filtering in dashboard

**US-FF-02:** As an editor, I want to immediately kill-switch a flag in production so that I can stop a bad feature from reaching users without a deployment.

**Acceptance Criteria:**
- Toggle button on dashboard changes `status` from `active` to `killed` immediately
- Killed flag serves `defaultValue` to all users regardless of targeting rules
- Kill-switch change propagates to all SDK instances within 100ms
- Kill-switch action is prominently highlighted in the audit log
- "EDITOR" role can kill-switch. "VIEWER" cannot.

---

### 2.4 A/B Experiment Module

**US-AB-01:** As a growth PM, I want to create an A/B experiment with multiple variants so that I can test which variant drives more conversions.

**Experiment Structure:**
```json
{
  "key": "checkout-cta-experiment",
  "name": "Checkout CTA Copy Test",
  "hypothesis": "Changing the CTA from 'Buy Now' to 'Complete Order' will reduce cart abandonment",
  "status": "running",
  "startedAt": "2026-01-15T10:00:00Z",
  "variants": [
    { "id": "control", "name": "Control", "weight": 50, "value": "Buy Now" },
    { "id": "variant-a", "name": "Complete Order", "weight": 50, "value": "Complete Order" }
  ],
  "metrics": {
    "primaryMetric": "checkout_completed",
    "secondaryMetrics": ["add_to_cart", "payment_started"]
  },
  "targeting": {
    "trafficAllocation": 80,
    "rules": [{ "attribute": "country", "operator": "equals", "value": "IN" }]
  },
  "requiredSampleSize": 1000,
  "confidenceLevel": 0.95
}
```

**Variant Assignment:** MurmurHash3 on `(userId + experimentKey)` → consistent, deterministic, no DB lookup at assignment time.

**Statistical Significance:** Welch's two-sample t-test (unequal variance) on conversion rates. Computed server-side on the hourly aggregation job. Dashboard shows p-value, confidence interval, and a plain-English verdict: "Variant A is performing 12.4% better with 97.2% statistical confidence."

**Acceptance Criteria:**
- Variant weights must sum to 100%
- Experiment can be paused (stops new assignments, preserves existing) or stopped (locks results)
- Minimum 2 variants, maximum 5 variants in V1
- Traffic allocation (0–100%) controls what % of eligible users enter the experiment
- Impression and conversion events tracked asynchronously via BullMQ (no sync DB write on hot path)
- Results dashboard updates on hourly aggregation cycle (not real-time to avoid misleading early data)
- Cannot delete a running experiment (must stop first)
- Required sample size auto-calculated based on expected effect size and confidence level (using power analysis formula)

**US-AB-02:** As an engineer, I want to track a conversion event from my application so that the experiment analytics update automatically.

**Acceptance Criteria:**
- SDK exposes `vault.track(eventName, userId, properties?)` method
- Events are POSTed to `/sdk/v1/events` in batches (SDK batches locally, flushes every 2s or 50 events, whichever comes first)
- Server validates API key, extracts workspace context, enqueues event to BullMQ
- Worker processes events, links to experiment via `impressions` table, increments counters
- Invalid or unrecognized event names are silently dropped (no SDK error thrown)

---

### 2.5 Audit Log Module

**US-AL-01:** As an admin, I want to see a full audit trail of every change made to flags and experiments so that I can understand who changed what and when.

**Acceptance Criteria:**
- Every create/update/delete/kill-switch/force-enable action logged immutably
- Audit log shows: actor (user email + role), action type, resource (flag/experiment key), before state (JSON diff), after state, timestamp, IP address
- Audit log is append-only — no API to delete entries
- Searchable by actor, resource key, action type, and date range
- Paginated (cursor-based, 50 items per page)
- Retained for 90 days in V1

---

### 2.6 SDK API Key Module

**US-KEY-01:** As a developer, I want to generate environment-specific SDK keys so that I can use different keys for staging vs production.

**Key Types:**
- `server-side` — full access (all flags + experiments). Never expose in browser.
- `client-side` — read-only, filtered to client-safe flags only. Safe to embed in frontend.

**Acceptance Criteria:**
- Keys generated as `fv_live_<32-char-hex>` (production) and `fv_test_<32-char-hex>` (staging)
- Keys stored as SHA-256 hashes in DB — never stored in plaintext after initial display
- Key can be revoked (immediately invalidated, active connections dropped within 5s via WebSocket)
- Max 10 active keys per project
- Key description is required (e.g., "Production API — Backend Service")

---

## 3. User Flows

### 3.1 New User Onboarding Flow

```
Landing Page
  └─► "Get Started Free" CTA
        └─► Signup Form (email + password)
              └─► Email Verification Sent (check inbox screen)
                    └─► Click Magic Link in Email
                          └─► Workspace Setup Wizard
                                ├─ Step 1: Workspace Name + Slug (auto-generated, editable)
                                ├─ Step 2: Create First Project (name + description)
                                └─ Step 3: Generate SDK Key (copy to clipboard)
                                      └─► Dashboard (empty state with "Create your first flag" CTA)
```

### 3.2 Flag Creation & Deployment Flow

```
Dashboard → Flags Tab → "+ New Flag"
  └─► Flag Creation Form
        ├─ Flag Key (slugified)
        ├─ Type (boolean/string/number/json)
        ├─ Default Value
        ├─ Description
        └─ Tags
              └─► Flag Created (disabled by default)
                    └─► "Configure Targeting" → Targeting Rules Builder
                          ├─ Add Conditions (attribute + operator + value)
                          ├─ Set Rollout % per Rule
                          └─ Set Default Rule
                                └─► "Enable Flag" → Confirmation Modal
                                      └─► Flag Active → Broadcast via WebSocket
                                            └─► All SDK instances receive update in < 100ms
```

### 3.3 SDK Integration Flow (Developer)

```
Developer installs SDK: npm install featurevault-node
  └─► Initialize with SDK key:
        const vault = new FeatureVault({ apiKey: 'fv_live_...' })
        await vault.connect()
              └─► SDK fetches full flag config via REST on init
                    └─► SDK subscribes to WebSocket channel (ws://api/ws/sync)
                          └─► Local in-memory cache populated
                                └─► Developer calls:
                                      vault.isEnabled('new-checkout-flow', { userId, plan })
                                      // Returns: true/false
                                      // Time: < 0.1ms (no network)
                                            └─► If flag changes in dashboard →
                                                  WS push → cache update → next call returns new value
```

### 3.4 A/B Experiment Flow

```
Dashboard → Experiments → "+ New Experiment"
  └─► Experiment Builder
        ├─ Key + Name + Hypothesis
        ├─ Add Variants (key + name + weight + value)
        ├─ Primary + Secondary Metrics
        ├─ Traffic Allocation %
        └─ Targeting Rules (optional)
              └─► "Launch Experiment"
                    └─► Experiment Running
                          └─► In Application:
                                const variant = vault.getVariant('checkout-cta', { userId })
                                // variant = 'control' | 'variant-a'
                                vault.track('checkout_completed', userId)
                                      └─► BullMQ Worker processes event
                                            └─► Hourly aggregation job calculates significance
                                                  └─► Dashboard shows live results
```

---

## 4. Technical Specifications

### 4.1 Full Tech Stack

#### Backend
| Layer | Technology | Justification |
|---|---|---|
| Runtime | Node.js 22 LTS | Native async, excellent ecosystem, same language as SDK |
| Framework | Fastify v5 | 2.5x faster than Express, built-in schema validation, plugin architecture |
| Language | TypeScript 5.5 | End-to-end type safety, better DX |
| ORM | Drizzle ORM | Type-safe queries, migration files, lighter than Prisma |
| Database | PostgreSQL 16 | JSONB for targeting rules, table partitioning, ACID compliance |
| Cache | Redis 7 (ioredis) | Flag state cache, pub/sub for invalidation, rate limiting, sessions |
| Queue | BullMQ 5 | Event analytics processing, email delivery, background jobs |
| WebSocket | `@fastify/websocket` | SDK sync channel, flag push notifications |
| Hashing | MurmurHash3 (`murmurhash`) | Consistent, fast, non-cryptographic hash for rollout bucketing |
| Password | `argon2` | OWASP-recommended, memory-hard, resistant to GPU cracking |
| JWT | `@fastify/jwt` | Access token generation and verification |
| Validation | Zod | Schema validation at API boundary + compile-time types |
| Email | Nodemailer + AWS SES | Transactional emails (verification, invites) |
| Testing | Vitest + Supertest | Unit + integration tests |
| Load Testing | k6 | Benchmark flag evaluation throughput |

#### Frontend
| Layer | Technology | Justification |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR for dashboard, SSG for public pages |
| Language | TypeScript 5.5 | Consistent with backend |
| Styling | Tailwind CSS v4 | Utility-first, co-located styles |
| UI Components | shadcn/ui (Radix primitives) | Accessible, unstyled, owned in codebase |
| State | Zustand | Lightweight, no boilerplate for flag list + WS sync state |
| Server State | TanStack Query v5 | Cache + invalidation for API calls |
| Forms | React Hook Form + Zod | Type-safe form validation |
| Charts | Recharts | A/B analytics, impression/conversion graphs |
| Icons | Phosphor Icons | Consistent, comprehensive, not Lucide |
| Animations | Framer Motion | Smooth transitions, flag toggle animations |
| Tables | TanStack Table v8 | Virtual scroll for audit logs (10k+ rows) |
| WebSocket | native `WebSocket` API | SDK sync status indicator, real-time flag change feed |

#### Infrastructure
| Layer | Technology |
|---|---|
| Container | Docker (multi-stage builds) |
| Orchestration (local) | Docker Compose |
| Orchestration (prod) | AWS ECS Fargate (V1) — easier than K8s for solo |
| Database | AWS RDS PostgreSQL 16 (Multi-AZ in prod) |
| Cache | AWS ElastiCache Redis 7 (cluster mode) |
| Queue Worker | Separate ECS Fargate task for BullMQ worker |
| Object Storage | AWS S3 (audit log exports, future file attachments) |
| CDN | AWS CloudFront (Next.js static assets) |
| DNS | AWS Route 53 |
| TLS | AWS ACM (auto-renewing SSL certs) |
| CI/CD | GitHub Actions |
| IaC | Terraform (AWS provider) |
| Container Registry | AWS ECR |
| Secrets | AWS Secrets Manager |
| Monitoring | AWS CloudWatch + custom Prometheus metrics |

---

## 5. Data Architecture & Schema

### 5.1 Entity Relationship Overview

```
users
  └── workspace_members (many-to-many via workspaces)
  
workspaces
  └── projects
        └── sdk_keys
        └── flags
              └── targeting_rules
              └── flag_versions (immutable snapshot history)
        └── experiments
              └── experiment_variants
              └── experiment_impressions (partitioned)
              └── experiment_events (partitioned)
              └── experiment_results (hourly aggregation)

workspaces
  └── workspace_invitations
  └── audit_logs (partitioned by created_at month)

users
  └── sessions
```

### 5.2 Core Table Schemas (Drizzle / SQL)

```sql
-- ================================================================
-- USERS & AUTH
-- ================================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,  -- argon2id
  full_name     VARCHAR(255),
  avatar_url    TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,  -- SHA-256 of the actual token
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token_hash ON sessions(refresh_token_hash);

CREATE TABLE email_verification_tokens (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

-- ================================================================
-- WORKSPACES & PROJECTS
-- ================================================================

CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,  -- URL-safe, e.g. 'acme-corp'
  plan        VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'enterprise'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         VARCHAR(20) NOT NULL DEFAULT 'viewer', -- 'owner'|'admin'|'editor'|'viewer'
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX idx_wm_user_id ON workspace_members(user_id);

CREATE TABLE workspace_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL,
  token_hash    TEXT NOT NULL,
  invited_by    UUID NOT NULL REFERENCES users(id),
  expires_at    TIMESTAMPTZ NOT NULL,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) NOT NULL,
  description   TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, slug)
);
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);

-- ================================================================
-- SDK KEYS
-- ================================================================

CREATE TABLE sdk_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,  -- e.g. 'Production Backend'
  key_prefix    VARCHAR(20) NOT NULL,   -- 'fv_live_' or 'fv_test_'
  key_hash      TEXT NOT NULL UNIQUE,   -- SHA-256 of the full key
  key_preview   VARCHAR(20) NOT NULL,   -- last 4 chars for display, e.g. '...a3f2'
  key_type      VARCHAR(20) NOT NULL,   -- 'server-side' | 'client-side'
  environment   VARCHAR(20) NOT NULL,   -- 'production' | 'staging' | 'development'
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sdk_keys_project_id ON sdk_keys(project_id);
CREATE INDEX idx_sdk_keys_key_hash ON sdk_keys(key_hash);

-- ================================================================
-- FEATURE FLAGS
-- ================================================================

CREATE TABLE flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key             VARCHAR(128) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  type            VARCHAR(20) NOT NULL DEFAULT 'boolean',  -- 'boolean'|'string'|'number'|'json'
  default_value   JSONB NOT NULL,  -- the value served when flag is off or no rule matches
  status          VARCHAR(20) NOT NULL DEFAULT 'inactive', -- 'inactive'|'active'|'killed'
  targeting_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  tags            VARCHAR(50)[] DEFAULT '{}',
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);
CREATE INDEX idx_flags_project_id ON flags(project_id);
CREATE INDEX idx_flags_key ON flags(key);

CREATE TABLE targeting_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id           UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  rule_order        INTEGER NOT NULL,  -- evaluation order, top-down
  name              VARCHAR(255),
  conditions        JSONB NOT NULL,  -- array of { attribute, operator, value }
  serve_value       JSONB NOT NULL,  -- the value to serve when this rule matches
  rollout_percentage INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_targeting_rules_flag_id ON targeting_rules(flag_id);

CREATE TABLE flag_versions (  -- Immutable snapshot of flag state at each change
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id       UUID NOT NULL REFERENCES flags(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  snapshot      JSONB NOT NULL,  -- full flag config at this version
  changed_by    UUID NOT NULL REFERENCES users(id),
  change_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  status              VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft'|'running'|'paused'|'stopped'
  traffic_allocation  INTEGER NOT NULL DEFAULT 100,
  primary_metric      VARCHAR(128) NOT NULL,
  secondary_metrics   VARCHAR(128)[] DEFAULT '{}',
  confidence_level    NUMERIC(4,3) NOT NULL DEFAULT 0.95,
  targeting_rules     JSONB DEFAULT '[]',
  started_at          TIMESTAMPTZ,
  stopped_at          TIMESTAMPTZ,
  winner_variant_id   UUID,  -- set when experiment is stopped
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, key)
);

CREATE TABLE experiment_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  key           VARCHAR(128) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  weight        INTEGER NOT NULL CHECK (weight BETWEEN 0 AND 100),
  value         JSONB NOT NULL,  -- the variant value served by SDK
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, key)
);
CREATE INDEX idx_exp_variants_experiment_id ON experiment_variants(experiment_id);

-- Partitioned by experiment_id range + created_at for scalability
-- Raw impression events (user entered experiment)
CREATE TABLE experiment_impressions (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES experiments(id),
  variant_id      UUID NOT NULL REFERENCES experiment_variants(id),
  user_id         VARCHAR(255) NOT NULL,  -- arbitrary string from application
  session_id      VARCHAR(255),
  properties      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE experiment_impressions_2026_01 
  PARTITION OF experiment_impressions 
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- Additional partitions created by migration job monthly

-- Conversion events
CREATE TABLE experiment_events (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  experiment_id   UUID NOT NULL REFERENCES experiments(id),
  variant_id      UUID NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  event_name      VARCHAR(128) NOT NULL,
  properties      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Hourly aggregated results (written by BullMQ aggregation job)
CREATE TABLE experiment_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id       UUID NOT NULL REFERENCES experiments(id),
  variant_id          UUID NOT NULL REFERENCES experiment_variants(id),
  metric_name         VARCHAR(128) NOT NULL,
  impressions         BIGINT NOT NULL DEFAULT 0,
  conversions         BIGINT NOT NULL DEFAULT 0,
  conversion_rate     NUMERIC(8,6),  -- conversions / impressions
  p_value             NUMERIC(10,8),
  confidence_interval JSONB,  -- { lower: 0.08, upper: 0.14 }
  is_significant      BOOLEAN,
  aggregated_at       TIMESTAMPTZ NOT NULL,
  UNIQUE(experiment_id, variant_id, metric_name, aggregated_at)
);

-- ================================================================
-- AUDIT LOGS (partitioned by month)
-- ================================================================

CREATE TABLE audit_logs (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL,
  project_id    UUID,
  actor_id      UUID NOT NULL,
  actor_email   VARCHAR(255) NOT NULL,
  actor_role    VARCHAR(20) NOT NULL,
  action        VARCHAR(50) NOT NULL,  -- 'flag.created'|'flag.updated'|'flag.killed'|'experiment.launched'...
  resource_type VARCHAR(50) NOT NULL,  -- 'flag'|'experiment'|'sdk_key'|'member'
  resource_id   UUID NOT NULL,
  resource_key  VARCHAR(255),          -- human-readable key (e.g., 'new-checkout-flow')
  before_state  JSONB,
  after_state   JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_audit_logs_workspace_id ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

### 5.3 Redis Key Design

```
# Flag state cache (per project) — LRU, 10min TTL
fv:flags:{projectId}                         → JSON string of all flags for project

# Individual flag (invalidated on update) — 10min TTL
fv:flag:{projectId}:{flagKey}                → JSON string of single flag

# Rate limiting — sliding window counter
fv:rl:login:{email}                          → integer (TTL: 900s)
fv:rl:sdk:{apiKeyHash}                       → integer (TTL: 60s)
fv:rl:api:{userId}                           → integer (TTL: 60s)

# WebSocket channel registry (which connection IDs are subscribed to which project)
fv:ws:project:{projectId}                    → SET of connectionIds

# Pub/Sub channels (for cross-instance flag invalidation broadcast)
fv:pubsub:flags:{projectId}                  → published when any flag in project changes

# Session token tracking (for immediate revocation)
fv:session:valid:{userId}                    → SET of valid session IDs (TTL: 7 days)

# BullMQ queue names
bull:sdk-events                              → raw SDK event queue
bull:email                                   → email delivery queue  
bull:aggregation                             → hourly stats aggregation
bull:partition-maintenance                   → monthly partition creation

# API response cache (short-lived, for read-heavy dashboard endpoints)
fv:cache:workspace:{workspaceId}:flags       → JSON string (TTL: 5s)
```

---

## 6. API Design

### 6.1 REST API Structure

**Base URL:** `https://api.featurevault.io/v1`  
**SDK URL:** `https://sdk.featurevault.io/v1` (separate domain, separate rate limits)

**Common Headers:**
```
Authorization: Bearer <accessToken>          # Dashboard API
X-API-Key: fv_live_<key>                    # SDK API
Content-Type: application/json
X-Request-ID: <uuid>                        # Idempotency + tracing
```

**Standard Response Envelope:**
```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "requestId": "...", "timestamp": "..." }
}

// Error
{
  "success": false,
  "error": {
    "code": "FLAG_KEY_ALREADY_EXISTS",
    "message": "A flag with key 'new-checkout-flow' already exists in this project.",
    "field": "key",
    "docs": "https://docs.featurevault.io/errors/FLAG_KEY_ALREADY_EXISTS"
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

### 6.2 Authentication Endpoints

```
POST   /auth/signup              # Create user + workspace
POST   /auth/login               # Returns accessToken + sets refreshToken cookie
POST   /auth/logout              # Invalidates session
POST   /auth/refresh             # Refresh access token (reads HttpOnly cookie)
POST   /auth/verify-email        # Verify email with token
POST   /auth/resend-verification # Resend verification email
POST   /auth/forgot-password     # Send password reset email
POST   /auth/reset-password      # Reset with token
GET    /auth/me                  # Returns current user + workspace memberships
```

### 6.3 Workspace & Project Endpoints

```
# Workspaces
GET    /workspaces/:workspaceSlug          # Get workspace details
PATCH  /workspaces/:workspaceId            # Update workspace name

# Members
GET    /workspaces/:workspaceId/members    # List members
POST   /workspaces/:workspaceId/invitations # Invite member (sends email)
PATCH  /workspaces/:workspaceId/members/:userId # Change role
DELETE /workspaces/:workspaceId/members/:userId # Remove member
POST   /invitations/:token/accept          # Accept invitation

# Projects
GET    /workspaces/:workspaceId/projects   # List projects
POST   /workspaces/:workspaceId/projects   # Create project
GET    /projects/:projectId                # Get project
PATCH  /projects/:projectId               # Update project
DELETE /projects/:projectId               # Delete project (soft delete)
```

### 6.4 Flag Endpoints

```
GET    /projects/:projectId/flags            # List flags (filter: status, tags, search)
POST   /projects/:projectId/flags            # Create flag
GET    /flags/:flagId                        # Get flag with targeting rules
PUT    /flags/:flagId                        # Full update (increments version)
PATCH  /flags/:flagId/status                 # Change status (active/inactive/killed)
PATCH  /flags/:flagId/targeting             # Update targeting rules
DELETE /flags/:flagId                        # Soft delete flag
GET    /flags/:flagId/versions              # Get version history (paginated)
GET    /flags/:flagId/versions/:version     # Get specific version snapshot
POST   /flags/:flagId/versions/:version/restore # Rollback to version
```

**GET /projects/:projectId/flags — Query Parameters:**
```
?status=active&tags=payments,checkout&search=checkout&page=1&limit=20
```

**POST /projects/:projectId/flags — Request Body:**
```json
{
  "key": "new-checkout-flow",
  "name": "New Checkout Flow",
  "description": "Redesigned checkout UX",
  "type": "boolean",
  "defaultValue": false,
  "tags": ["checkout", "payments"]
}
```

**PUT /flags/:flagId — Request Body (full update with targeting):**
```json
{
  "name": "New Checkout Flow",
  "description": "Updated description",
  "defaultValue": false,
  "targetingEnabled": true,
  "rules": [
    {
      "id": "rule-001",
      "name": "Beta users",
      "order": 1,
      "conditions": [
        { "attribute": "plan", "operator": "in", "value": ["beta", "enterprise"] }
      ],
      "serveValue": true,
      "rolloutPercentage": 100
    }
  ]
}
```

### 6.5 Experiment Endpoints

```
GET    /projects/:projectId/experiments       # List experiments
POST   /projects/:projectId/experiments       # Create experiment
GET    /experiments/:experimentId             # Get experiment + variants
PUT    /experiments/:experimentId             # Update experiment (draft only)
POST   /experiments/:experimentId/launch      # Launch (draft → running)
POST   /experiments/:experimentId/pause       # Pause running experiment
POST   /experiments/:experimentId/stop        # Stop + declare winner
DELETE /experiments/:experimentId             # Delete (draft only)
GET    /experiments/:experimentId/results     # Get latest aggregated results
GET    /experiments/:experimentId/timeseries  # Conversion rate over time (for chart)
```

### 6.6 SDK Endpoints (different auth: X-API-Key)

```
# Called once on SDK init — returns all flag configs for the project
GET    /sdk/v1/flags
Response: {
  "flags": {
    "new-checkout-flow": { "type": "boolean", "defaultValue": false, "targeting": {...} },
    "checkout-cta-experiment": { "type": "experiment", "variants": [...] }
  },
  "syncToken": "eyJ...",  // passed to WebSocket on connect
  "projectId": "...",
  "projectSlug": "..."
}

# Called for client-side keys (filtered, no server-only flags)
GET    /sdk/v1/flags?clientSide=true

# Batch event tracking (impressions + conversions)
POST   /sdk/v1/events
Body: {
  "events": [
    {
      "type": "impression",
      "experimentKey": "checkout-cta-experiment",
      "variantKey": "variant-a",
      "userId": "usr_12345",
      "timestamp": "2026-01-15T10:30:00.000Z"
    },
    {
      "type": "conversion",
      "eventName": "checkout_completed",
      "userId": "usr_12345",
      "properties": { "revenue": 299.99 },
      "timestamp": "2026-01-15T10:32:00.000Z"
    }
  ]
}

# SDK health check
GET    /sdk/v1/health
```

### 6.7 WebSocket Protocol

**Endpoint:** `wss://sdk.featurevault.io/v1/sync`

**Connection (client → server):**
```json
{
  "type": "subscribe",
  "apiKey": "fv_live_...",
  "syncToken": "eyJ...",  // from initial REST fetch — identifies what the client has
  "sdkVersion": "1.2.0"
}
```

**Subscription Acknowledged (server → client):**
```json
{
  "type": "subscribed",
  "projectId": "...",
  "flagCount": 42,
  "connectionId": "conn_abc123"
}
```

**Flag Update (server → client, pushed on any flag change):**
```json
{
  "type": "flag_updated",
  "flagKey": "new-checkout-flow",
  "flag": {
    "key": "new-checkout-flow",
    "type": "boolean",
    "defaultValue": false,
    "status": "killed",
    "targeting": { "enabled": false, "rules": [] }
  },
  "changeType": "killed",  // 'created'|'updated'|'killed'|'deleted'
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

**Heartbeat (bidirectional, every 30s):**
```json
{ "type": "ping" }  // client
{ "type": "pong", "serverTime": "..." }  // server
```

**Reconnect Logic (SDK-side):** Exponential backoff — 1s, 2s, 4s, 8s, max 30s. On reconnect, SDK re-fetches full flag config via REST to guarantee no missed updates.

### 6.8 Audit Log Endpoints

```
GET    /workspaces/:workspaceId/audit-logs
  ?page=1&limit=50
  &actorId=...
  &resourceType=flag
  &resourceKey=new-checkout-flow
  &action=flag.killed
  &from=2026-01-01&to=2026-01-31

GET    /workspaces/:workspaceId/audit-logs/export  # Returns pre-signed S3 URL for CSV export
```

---

## 7. SDK Design

### 7.1 Node.js SDK Architecture (`featurevault-node`)

```typescript
// ================================================================
// PUBLIC API
// ================================================================

import { FeatureVault } from 'featurevault-node'

const vault = new FeatureVault({
  apiKey: 'fv_live_...',
  baseUrl: 'https://sdk.featurevault.io',  // optional, defaults to cloud
  connectTimeout: 5000,    // ms before connect() throws
  flushInterval: 2000,     // ms between event batch flushes
  maxBatchSize: 50,        // events before immediate flush
  offline: false,          // if true, never make network calls (for tests)
})

// Must be called once at application startup
await vault.connect()

// Feature flag evaluation (< 0.1ms, no network)
const isEnabled: boolean = vault.isEnabled('new-checkout-flow', {
  userId: 'usr_12345',
  attributes: {
    plan: 'enterprise',
    email: 'arjun@example.com',
    country: 'IN'
  }
})

// String/number/JSON flag
const variant: string = vault.getStringFlag('api-response-format', 'v2', { userId })
const timeout: number = vault.getNumberFlag('request-timeout-ms', 3000, { userId })
const config: object = vault.getJSONFlag('ui-config', {}, { userId })

// A/B experiment variant assignment (deterministic, no network)
const expVariant: string = vault.getVariant('checkout-cta-experiment', {
  userId: 'usr_12345',
  attributes: { ... }
})  // returns 'control' | 'variant-a'

// Event tracking (batched, async — no await needed)
vault.track('checkout_completed', 'usr_12345', { revenue: 299.99 })

// Graceful shutdown (flushes pending events)
await vault.close()
```

### 7.2 SDK Internal Architecture

```
FeatureVault (public class)
  │
  ├── FlagStore (in-memory Map<flagKey, FlagConfig>)
  │     └── Populated on connect(), updated by WebSocketClient
  │
  ├── RuleEngine (pure functions, no I/O)
  │     ├── evaluateFlag(flag, userContext) → value
  │     ├── matchesConditions(conditions, userContext) → boolean
  │     ├── getBucket(userId, flagKey) → 0-100  // MurmurHash3
  │     └── resolveRules(rules, userContext) → value | null
  │
  ├── WebSocketClient
  │     ├── connect(syncToken) → Promise<void>
  │     ├── onFlagUpdate(handler) → subscription
  │     ├── keepAlive (ping/pong every 30s)
  │     └── reconnect (exponential backoff)
  │
  ├── RestClient
  │     ├── fetchFlags() → FlagConfig[]  // called on connect()
  │     └── postEvents(events[]) → void  // called by EventBatcher
  │
  └── EventBatcher
        ├── queue: Event[]
        ├── add(event) → void
        ├── flush() → Promise<void>  // HTTP POST to /sdk/v1/events
        └── scheduleFlush (setInterval every flushInterval ms)
```

---

## 8. Frontend Architecture & Components

### 8.1 Next.js Route Structure

```
app/
  (marketing)/          # Public pages, no auth required
    page.tsx            # Landing page
    pricing/page.tsx
    docs/page.tsx
    
  (auth)/               # Auth pages, redirect to dashboard if logged in
    login/page.tsx
    signup/page.tsx
    verify-email/page.tsx
    forgot-password/page.tsx
    reset-password/[token]/page.tsx
    
  (dashboard)/          # Protected, requires auth + workspace context
    layout.tsx          # Workspace sidebar + top nav + WS connection
    
    [workspaceSlug]/
      page.tsx                          # Workspace overview
      
      [projectSlug]/
        flags/
          page.tsx                      # Flags list
          [flagKey]/page.tsx            # Flag detail + targeting editor
          new/page.tsx                  # Create flag
          
        experiments/
          page.tsx                      # Experiments list
          [experimentKey]/page.tsx      # Experiment detail + results
          new/page.tsx                  # Create experiment
          
        settings/
          page.tsx                      # Project settings
          sdk-keys/page.tsx             # SDK key management
          
      settings/
        page.tsx                        # Workspace settings
        members/page.tsx                # Team management
        audit-log/page.tsx              # Audit log viewer
        
  api/                  # Next.js API routes (proxies to Fastify, adds CSRF)
    auth/[...nextauth]
```

### 8.2 Key Frontend Components

| Component | Description | Complexity |
|---|---|---|
| `FlagStatusToggle` | Animated toggle (inactive → active → killed). Shows propagation indicator (green pulse when WS confirms delivery) | High |
| `TargetingRuleBuilder` | Drag-to-reorder rules, condition builder with attribute/operator/value dropdowns, live preview ("User with plan=enterprise would get: true") | Very High |
| `RolloutSlider` | Percentage rollout input with visual bar, live estimate ("~4,800 of your 48,000 users") | Medium |
| `ExperimentBuilder` | Multi-step wizard: variants editor → metrics picker → targeting → launch confirmation | Very High |
| `ExperimentResults` | Recharts line graph (conversion rate over time), stat significance badge, bar chart comparison, winner declaration UI | High |
| `AuditLogTable` | TanStack Table with virtual scroll, JSON diff viewer (before/after), actor avatar + role badge | High |
| `SDKKeyCard` | One-time reveal (blurred until copy-clicked), revoke button, last-used badge | Medium |
| `RealtimeFlagFeed` | Right-side drawer showing live flag changes as they happen (WebSocket events visualized) | Medium |
| `WorkspaceSidebar` | Collapsible, project switcher, role-aware nav items (VIEWER sees no "Create" buttons) | Medium |
| `RBACGate` | `<RBACGate requires="editor">` wrapper component that hides/disables children based on user role | Low |
| `JsonFlagEditor` | Monaco Editor lite for JSON flag type values | Medium |
| `OnboardingWizard` | 3-step setup flow with progress bar and confetti on completion | Medium |

### 8.3 State Management Architecture

```
Zustand Stores:

1. authStore
   - user: User | null
   - workspace: Workspace | null
   - role: Role | null
   - actions: login(), logout(), setWorkspace()

2. flagStore
   - flags: Map<flagKey, Flag>
   - isLoading: boolean
   - actions: setFlags(), updateFlag(), removeFlag()
   - populated by: TanStack Query on mount, then live-updated by WS

3. wsStore
   - status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
   - lastEvent: FlagUpdateEvent | null
   - connectionId: string | null
   - actions: setStatus(), setLastEvent()

TanStack Query (server state):
   - useFlags(projectId) → flags list with SWR caching
   - useFlag(flagId) → single flag with targeting rules
   - useExperiments(projectId)
   - useExperimentResults(experimentId)
   - useAuditLogs(workspaceId, filters)
   - useSdkKeys(projectId)
```

### 8.4 WebSocket Connection (Frontend)

```typescript
// Singleton WS client, initialized in dashboard layout
// Connects to Fastify WS (not SDK WS — this is the dashboard's own real-time channel)

const ws = new DashboardWebSocket({
  endpoint: '/ws/dashboard',
  token: accessToken,
  onFlagChange: (event) => {
    // Update Zustand flagStore
    flagStore.updateFlag(event.flagKey, event.flag)
    // Show toast notification
    toast.info(`Flag "${event.flagKey}" was ${event.changeType}`)
  },
  onConnect: () => wsStore.setStatus('connected'),
  onDisconnect: () => wsStore.setStatus('disconnected'),
})
```

---

## 9. Infrastructure & Deployment

### 9.1 Docker Compose (Local / Self-Host)

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infra/init.sql:/docker-entrypoint-initdb.d/init.sql
    environment:
      POSTGRES_DB: featurevault
      POSTGRES_USER: fv_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fv_user"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      target: production
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://fv_user:${DB_PASSWORD}@postgres:5432/featurevault
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      API_BASE_URL: ${API_BASE_URL}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
    ports:
      - "4000:4000"
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    deploy:
      replicas: 2
      restart_policy: { condition: on-failure, max_attempts: 3 }

  worker:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
      target: production
    command: node dist/worker.js  # BullMQ worker entry point (separate process)
    environment:
      DATABASE_URL: postgresql://fv_user:${DB_PASSWORD}@postgres:5432/featurevault
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    deploy:
      replicas: 1

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
      target: production
    environment:
      NEXT_PUBLIC_API_URL: ${API_BASE_URL}
      NEXT_PUBLIC_WS_URL: ${WS_BASE_URL}
    ports:
      - "3000:3000"
    depends_on:
      - api

  nginx:
    image: nginx:alpine
    volumes:
      - ./infra/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./infra/ssl:/etc/nginx/ssl:ro  # optional, use Caddy for auto-TLS
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
      - web

volumes:
  postgres_data:
  redis_data:
```

### 9.2 Multi-Stage Dockerfile (API)

```dockerfile
# apps/api/Dockerfile

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build  # tsc → dist/

# Stage 3: Production (minimal image, ~120MB)
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S fastify -u 1001
COPY --from=deps --chown=fastify:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=fastify:nodejs /app/dist ./dist
COPY --from=builder --chown=fastify:nodejs /app/package.json ./
USER fastify
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "require('http').get('http://localhost:4000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"
CMD ["node", "dist/server.js"]
```

### 9.3 GitHub Actions CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
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
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
    env:
      DATABASE_URL: postgresql://fv_user:test_password@localhost:5432/fv_test
      REDIS_URL: redis://localhost:6379
      JWT_ACCESS_SECRET: test_secret_access
      JWT_REFRESH_SECRET: test_secret_refresh
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run db:migrate:test
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2
      - name: Build & push API image
        run: |
          docker build -t $ECR_REGISTRY/featurevault-api:$GITHUB_SHA \
            --target production apps/api
          docker push $ECR_REGISTRY/featurevault-api:$GITHUB_SHA
      - name: Build & push Web image
        run: |
          docker build -t $ECR_REGISTRY/featurevault-web:$GITHUB_SHA apps/web
          docker push $ECR_REGISTRY/featurevault-web:$GITHUB_SHA

  deploy:
    runs-on: ubuntu-latest
    needs: build
    environment: production
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster featurevault-prod \
            --service featurevault-api \
            --force-new-deployment
          aws ecs wait services-stable \
            --cluster featurevault-prod \
            --services featurevault-api
      - name: Smoke test
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.featurevault.io/health)
          if [ "$STATUS" != "200" ]; then exit 1; fi
      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text":"🚨 FeatureVault deploy failed on ${{ github.sha }}"}'
```

### 9.4 Terraform Architecture

```
infra/
  terraform/
    main.tf
    variables.tf
    outputs.tf
    
    modules/
      networking/      # VPC, subnets (2 public, 2 private, 2 database), NAT Gateway, IGW
      ecs/             # ECS cluster, Fargate task definitions, services, IAM roles
      rds/             # RDS PostgreSQL 16, Multi-AZ (prod), subnet group, security group
      elasticache/     # Redis 7 cluster, subnet group, security group
      alb/             # Application Load Balancer, target groups, HTTPS listener
      acm/             # ACM certificate for api.featurevault.io + *.featurevault.io
      ecr/             # ECR repositories (api, web, worker)
      secrets/         # Secrets Manager entries, IAM policies for ECS to read secrets
      cloudwatch/      # Log groups, metric alarms (CPU, memory, RDS connections, 5xx rate)
      s3/              # Audit log exports bucket, CloudFront distribution for web assets
```

**Terraform State:**
- Remote state in S3 bucket (`featurevault-terraform-state`) with DynamoDB table for state locking
- Separate workspaces: `staging` and `production`

---

## 10. Non-Functional Requirements

### 10.1 Performance Benchmarks

| Metric | Target | How Measured |
|---|---|---|
| SDK flag evaluation latency | < 0.1ms p99 | k6 load test, no network involved |
| Flag propagation (dashboard change → SDK receives update) | < 100ms p95 | Instrumented test with WS listener |
| REST API response time (read endpoints) | < 50ms p95 | k6, CloudWatch |
| REST API response time (write endpoints) | < 200ms p95 | k6, CloudWatch |
| SDK `/sdk/v1/flags` init fetch | < 300ms p95 | CloudWatch |
| Dashboard LCP (Largest Contentful Paint) | < 2.5s | Vercel Analytics / Lighthouse CI |
| Dashboard CLS (Cumulative Layout Shift) | < 0.1 | Lighthouse CI |
| Event batch processing lag (SDK event → DB) | < 30s p99 | BullMQ job timing metrics |

### 10.2 Scalability Design

**Horizontal scaling for 10,000+ concurrent users:**

1. **Stateless API servers** — All session state in Redis, all flag state in Redis + PostgreSQL. Add Fargate replicas with zero config.

2. **WebSocket scaling** — The critical problem: WebSocket connections are stateful. Solution:
   - Each API instance registers its connected SDK clients in Redis (`fv:ws:project:{projectId}` → SET of `{instanceId}:{connectionId}`)
   - When a flag changes, the API instance that processed the write publishes to Redis pub/sub channel `fv:pubsub:flags:{projectId}`
   - All API instances subscribe to this channel, and each pushes the update to their locally-connected WebSocket clients
   - No inter-service communication needed, no sticky sessions required

3. **Database connection pooling** — PgBouncer sidecar (or AWS RDS Proxy) pools connections. Each Fargate task connects to PgBouncer, not directly to RDS. Target: 20 app connections per instance, PgBouncer maintains 10 actual DB connections.

4. **Read replicas** — RDS read replica for analytics-heavy queries (experiment results, audit log reads). Route all `SELECT` queries for these modules to the read replica.

5. **BullMQ workers** — Separate ECS service, scale independently based on queue depth metric (CloudWatch custom metric from BullMQ). Target: process event queue backlog within 5s.

6. **CDK Autoscaling triggers:**
   - API service: Scale out when CPU > 60% for 2 consecutive minutes. Scale in when CPU < 20% for 10 minutes.
   - Worker service: Scale out when BullMQ queue depth > 1000 unprocessed jobs. Scale in when depth < 100.

### 10.3 Availability

- **Target SLA:** 99.9% uptime (< 8.7 hours downtime/year)
- RDS Multi-AZ for automatic failover (< 60s failover time)
- ECS Fargate Spot instances for worker (non-critical, cost saving) + On-Demand for API
- ALB health checks: `/health` endpoint, deregister instance if 3 consecutive failures
- Redis ElastiCache cluster mode with automatic failover
- Graceful shutdown: API drains connections for 30s before ECS stops a task (prevents mid-request termination)

### 10.4 Accessibility (WCAG 2.2 AA)

- All interactive elements keyboard-navigable (Tab focus, Enter/Space activation)
- Color contrast ratio ≥ 4.5:1 for text
- ARIA labels on all icon-only buttons
- Screen reader announcements on flag toggle state changes (`aria-live="polite"`)
- Focus management in modals (trap focus, return on close)
- Error messages associated with form fields via `aria-describedby`
- No motion for users with `prefers-reduced-motion` enabled

---

## 11. Security Architecture

### 11.1 Authentication Security

| Threat | Mitigation |
|---|---|
| Password brute force | 5 attempts per 15min per email (Redis sliding window) → 429 + `Retry-After` header |
| Credential stuffing | Argon2id hashing (memory-hard, makes mass comparison expensive) |
| Session hijacking | Refresh tokens: HttpOnly + Secure + SameSite=Strict cookies, single-use with rotation |
| Token replay attack | On refresh token reuse: immediately invalidate ALL sessions for that user |
| JWT forgery | RS256 asymmetric signing (not HS256). Public key exposed at `/auth/.well-known/jwks.json` |
| Phishing (OAuth later) | Email verification required before any API access |
| Invitation abuse | Invitation tokens hashed in DB, single-use, expire in 48h |

### 11.2 API Security

| Threat | Mitigation |
|---|---|
| SQL Injection | Drizzle ORM (parameterized queries only). `pg` driver with no string interpolation |
| XSS | Next.js escapes output by default. `dangerouslySetInnerHTML` not used. CSP headers |
| CSRF | Double-submit cookie pattern. `SameSite=Strict` on session cookie. CSRF token for state-changing requests |
| SSRF | No user-controlled URLs fetched server-side in V1 |
| IDOR | All resource access checks `workspace_members` for membership + role before query |
| Rate limiting | Per-user rate limit on REST API (60 req/min, Redis sliding window). Per-key on SDK API (10,000 req/min) |
| Mass assignment | Explicit `pick()` on all request bodies before DB writes (no spread of `req.body` into ORM) |
| Enumeration | Auth endpoints return same response time on success/failure (constant-time comparison for tokens) |
| Clickjacking | `X-Frame-Options: DENY` header on all responses |

### 11.3 Data Security

| Concern | Approach |
|---|---|
| Data at rest | AWS RDS encryption (AES-256), EBS encryption on EC2/ECS volumes |
| Data in transit | TLS 1.3 minimum on all endpoints (ACM cert, enforced at ALB) |
| Secrets management | No secrets in environment files. All secrets in AWS Secrets Manager. ECS task IAM role reads secrets at startup |
| SDK key storage | SHA-256 hash stored in DB. Plaintext never stored. One-time display to user on creation |
| Audit log immutability | No `DELETE` or `UPDATE` queries permitted on `audit_logs` table. Checked via DB-level trigger |
| PII handling | User email stored. No IP addresses in analytics data. Audit log IPs retained 90 days then purged |
| CORS | Explicit allowlist: dashboard domain + localhost for development. No wildcard `*` |

### 11.4 Security Headers (Nginx / Next.js)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' wss://sdk.featurevault.io
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 11.5 SDK Security Considerations

- Server-side keys never exposed to browser (documentation explicitly warns against this)
- Client-side keys return filtered flag list (only flags tagged `client-safe`)
- SDK WebSocket connection authenticated via HMAC signature on initial handshake, not just API key
- SDK does not persist flag data to disk — in-memory only, no localStorage

---

## 12. Observability & Monitoring

### 12.1 Structured Logging

```typescript
// All logs emitted as JSON via Pino (Fastify's default, fastest Node.js logger)
{
  "level": "info",
  "time": 1705312200000,
  "requestId": "req_abc123",
  "userId": "usr_456",
  "workspaceId": "ws_789",
  "method": "PUT",
  "url": "/v1/flags/flg_123",
  "statusCode": 200,
  "responseTime": 45,
  "action": "flag.updated",
  "flagKey": "new-checkout-flow"
}
```

Log levels: `trace` (dev only) → `debug` → `info` → `warn` → `error` → `fatal`  
Sensitive fields stripped before logging: passwords, tokens, full API keys.

### 12.2 Custom Metrics (CloudWatch + optional Prometheus)

```
# API metrics
featurevault_http_requests_total{method, route, status_code}
featurevault_http_request_duration_ms{method, route, status_code}
featurevault_websocket_connections_active{project_id}
featurevault_flag_evaluations_total (SDK endpoint hits)
featurevault_flag_propagation_duration_ms (WS push latency)

# Business metrics
featurevault_flags_total{workspace_id, status}
featurevault_experiments_active{workspace_id}
featurevault_sdk_events_queued{queue_name}
featurevault_sdk_events_processed_total{queue_name}

# Database metrics
featurevault_db_query_duration_ms{operation, table}
featurevault_db_pool_active_connections
featurevault_db_pool_idle_connections
```

### 12.3 Alerting Rules

| Alert | Condition | Severity | Action |
|---|---|---|---|
| High error rate | 5xx rate > 1% for 5 min | Critical | PagerDuty |
| API latency spike | p95 > 500ms for 5 min | Warning | Slack |
| Worker backlog | BullMQ queue depth > 10,000 for 5 min | Warning | Slack |
| DB connection exhaustion | Active connections > 90% max | Critical | PagerDuty |
| Failed flag propagation | Any WS push fails for > 30s | Critical | PagerDuty |
| RDS failover | RDS health check failure | Critical | PagerDuty |
| Memory pressure | Container memory > 85% | Warning | Slack |
| Dead man's switch | No events processed for 15 min (worker down) | Critical | PagerDuty |

---

## 13. Success Metrics

### 13.1 Technical KPIs (self-hosting health)

| KPI | Target |
|---|---|
| Flag evaluation latency | < 0.1ms p99 |
| Flag change propagation | < 100ms p95 |
| API uptime | > 99.9% |
| Test coverage | > 80% |
| SDK npm weekly downloads | > 500/week within 3 months of launch |

### 13.2 Product KPIs (for hosted version)

| KPI | Target (6 months) |
|---|---|
| Registered workspaces | 200+ |
| Daily Active Workspaces | 50+ |
| Flags created | 2,000+ total |
| Experiments run | 300+ total |
| SDK npm downloads | 5,000+ total |
| GitHub stars | 500+ |

### 13.3 Analytics Events to Track (PostHog)

```
workspace_created          { plan }
project_created            { workspace_id }
flag_created               { type, has_targeting }
flag_status_changed        { old_status, new_status }
flag_kill_switched         { flag_key, workspace_id }
experiment_launched        { variant_count, traffic_allocation }
experiment_stopped         { duration_days, is_significant }
sdk_key_created            { key_type, environment }
invite_sent                { role }
invite_accepted            { role }
page_viewed                { page_name }
```

---

## 14. Build Timeline

### Phase 1: Foundation (Weeks 1–2)
**Goal:** Data layer, auth, and database running before any feature code.

- [ ] Project setup: monorepo (`apps/api`, `apps/web`, `packages/sdk`), TypeScript config, ESLint, Prettier
- [ ] Docker Compose with Postgres + Redis + API skeleton
- [ ] Drizzle ORM setup, all migrations written (users, sessions, workspaces, projects, sdk_keys, flags, experiments tables)
- [ ] Auth module: signup, login (Argon2id), JWT (RS256), refresh rotation, email verification
- [ ] Email service: Nodemailer + SES templates (verification, invite)
- [ ] Workspace CRUD + member invite flow + RBAC middleware
- [ ] Project CRUD + SDK key generation
- [ ] Auth middleware (JWT verify, workspace membership check, role check)
- [ ] Rate limiting middleware (Redis sliding window)
- [ ] `/health` endpoint + structured logging (Pino)
- [ ] **Deliverable:** Can sign up, create workspace + project, generate SDK key. All via Postman.

### Phase 2: Core Feature Engine (Weeks 3–4)
**Goal:** Flag CRUD, rule engine, and real-time propagation working end-to-end.

- [ ] Flag CRUD API (create, read, update, delete, list with filters)
- [ ] Targeting rule builder + JSONB storage
- [ ] MurmurHash3 rule engine (pure functions, 100% unit tested)
- [ ] Flag versioning (snapshot on every write)
- [ ] Audit log writes (on every mutation)
- [ ] Redis flag cache + invalidation on write
- [ ] Redis pub/sub publisher (fires on flag change)
- [ ] WebSocket server (`/ws/sync` for SDK, `/ws/dashboard` for UI)
- [ ] Pub/sub subscriber → WebSocket push
- [ ] SDK package skeleton (`packages/sdk`): FlagStore, WebSocketClient, RuleEngine, EventBatcher
- [ ] SDK integration test: change flag in API → SDK receives update in < 100ms
- [ ] **Deliverable:** Full flag lifecycle working. SDK evaluates flags locally. Pub/sub propagation confirmed.

### Phase 3: Experiments + Analytics (Weeks 5–6)
**Goal:** A/B experiment system, event pipeline, and aggregated results dashboard.

- [ ] Experiment CRUD API (create, launch, pause, stop)
- [ ] Variant assignment in SDK (MurmurHash3 consistent bucketing)
- [ ] `vault.track()` → EventBatcher → `/sdk/v1/events` → BullMQ queue
- [ ] BullMQ worker: `sdk-events` queue → parse events → write to `experiment_impressions` + `experiment_events`
- [ ] BullMQ scheduled job: hourly aggregation → Welch's t-test → write to `experiment_results`
- [ ] Experiment results API (current results + time-series)
- [ ] Publish `featurevault-node` to npm (with README, TypeScript types, examples)
- [ ] Next.js dashboard: auth flows (login, signup, email verify, forgot password)
- [ ] Dashboard: workspace setup wizard (onboarding flow)
- [ ] Dashboard: flags list + flag detail + targeting rule builder UI
- [ ] Dashboard: flag toggle with WebSocket propagation indicator
- [ ] **Deliverable:** Full A/B experiment lifecycle. SDK published on npm. Core dashboard usable.

### Phase 4: Polish, Security & Deployment (Weeks 7–8)
**Goal:** Production-hardened, deployed on AWS, publicly accessible.

- [ ] Dashboard: experiment builder, experiment results with Recharts graphs
- [ ] Dashboard: audit log viewer (TanStack Table virtual scroll, JSON diff)
- [ ] Dashboard: SDK key management, team management (invite + RBAC UI)
- [ ] RBAC UI gates (VIEWER cannot see create buttons)
- [ ] Security hardening: CORS config, CSP headers, CSRF tokens, security header middleware
- [ ] Terraform modules: networking, ECS, RDS, ElastiCache, ALB, ACM, ECR, Secrets Manager
- [ ] GitHub Actions CI/CD: lint → test → Docker build → ECR push → ECS deploy → smoke test
- [ ] k6 load test: flag evaluation throughput benchmark (target: 10k flag eval/s)
- [ ] README: architecture diagram, Docker Compose quickstart, SDK usage guide
- [ ] Landing page (`/`)
- [ ] Loom demo video recording
- [ ] **Deliverable:** Live on AWS. npm SDK published. Public demo instance. k6 benchmark in README.

---

## 15. Risks & Open Questions

### 15.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| WebSocket connection management at scale | Medium | High | Redis pub/sub decouples instances. Load tested before ship. |
| BullMQ worker crash causing event loss | Low | Medium | BullMQ has built-in retry (3 attempts, exponential backoff). Failed jobs move to dead-letter queue, not dropped. |
| MurmurHash3 distribution skew | Low | Medium | Unit test with 100k simulated users to verify ±2% tolerance at each percentage threshold |
| PostgreSQL partition management | Medium | Low | Monthly partition creation via scheduled BullMQ job. Alert if partition doesn't exist for next month. |
| SDK WebSocket reconnect causing state drift | Medium | High | On reconnect, always re-fetch full config via REST before re-subscribing. Sync token used to detect missed updates. |
| npm package maintenance | Low | Low | SDK is simple, no heavy dependencies. Only 3 runtime deps: `murmurhash`, `ws`, `debug`. |

### 15.2 External Dependencies

| Dependency | Risk |
|---|---|
| AWS SES (email) | Account warm-up needed. Start with Mailhog locally, SES for prod. |
| npm registry | Critical for SDK publishing. No alternative, but SDK can be git-installed. |
| AWS (overall) | Cannot ship without AWS account. Alternative: Docker Compose is fully self-contained for demos. |

### 15.3 Open Questions (to decide before Phase 2)

1. **Targeting attribute schema** — Are user attributes validated server-side (requires SDK to send user context to API) or purely client-defined (any string is valid)? → Decision: Client-defined, no server validation. Documented in SDK.

2. **Flag deletion behavior** — Soft delete (hide from UI, preserve audit history) or hard delete (gone completely)? → Decision: Soft delete. `deleted_at` column. Permanently deleted after 30 days.

3. **Free tier limits** — For hosted version: max flags per workspace? Max projects? → Decision: 10 projects, 100 flags, unlimited experiments. Enough for all real use cases. Prevents abuse.

4. **SDK offline behavior** — If SDK loses WS + can't reach API, should it serve cached values or default values? → Decision: Serve stale cached values from memory (last-known state). Never serve empty/null. Document this behavior clearly.

5. **Experiment assignment stickiness** — What if a user is assigned `variant-a`, experiment is paused, then resumed? → Decision: On pause, assignment is frozen. On resume, the same user gets the same variant (deterministic hash guarantees this without sticky session storage).

---

## 16. Gherkin Scenarios

*(Agent-ready test specifications — for Vitest/Supertest integration tests)*

### Auth

```gherkin
Feature: User Authentication

  Scenario: Successful signup
    Given a POST to /auth/signup with valid email and strong password
    When the request is processed
    Then response status is 201
    And response body contains { userId, workspaceId }
    And a workspace_members record exists with role "owner"
    And an email_verification_tokens record is created

  Scenario: Login rate limiting
    Given 5 failed login attempts from the same email within 15 minutes
    When a 6th login attempt is made
    Then response status is 429
    And response header Retry-After is present
    And Redis key "fv:rl:login:{email}" equals 5

  Scenario: Refresh token rotation
    Given a user is logged in with a valid refreshToken cookie
    When POST /auth/refresh is called
    Then response status is 200
    And a new accessToken is returned
    And the old refreshToken is invalidated in the database
    And a new refreshToken cookie is set

  Scenario: Refresh token replay attack
    Given a valid refreshToken has already been used once
    When the same refreshToken is used again
    Then response status is 401
    And all sessions for that user are deleted from the sessions table
```

### Feature Flags

```gherkin
Feature: Flag Lifecycle

  Scenario: Create a boolean flag
    Given an authenticated editor user in a project
    When POST /projects/{projectId}/flags with key "dark-mode" and type "boolean"
    Then response status is 201
    And flag is created with status "inactive"
    And an audit_log entry is created with action "flag.created"
    And Redis key "fv:flags:{projectId}" is invalidated

  Scenario: Kill switch broadcasts to WebSocket
    Given a flag with status "active" and connected SDK instances
    When PATCH /flags/{flagId}/status with { status: "killed" }
    Then flag status is updated to "killed" in the database
    And a Redis pub/sub message is published to "fv:pubsub:flags:{projectId}"
    And all connected SDK WebSocket clients receive a flag_updated message within 100ms
    And the received message contains { changeType: "killed" }

  Scenario: Targeting rule evaluation — percentage rollout
    Given a flag with 10% rollout rule and 1000 test users
    When isEnabled is called for each user with MurmurHash3 bucketing
    Then between 80 and 120 users receive true (within ±2% of 10%)

  Scenario: VIEWER cannot modify flags
    Given an authenticated viewer user
    When PUT /flags/{flagId} is attempted
    Then response status is 403
    And response error code is "INSUFFICIENT_PERMISSIONS"
```

### A/B Experiments

```gherkin
Feature: Experiment Management

  Scenario: Launch an experiment
    Given a draft experiment with 2 variants summing to 100% weight
    When POST /experiments/{experimentId}/launch
    Then experiment status changes to "running"
    And experiment.started_at is set to current time
    And an audit_log entry is created with action "experiment.launched"

  Scenario: Variant assignment is deterministic
    Given a running experiment with key "checkout-cta"
    When getVariant is called 100 times for the same userId
    Then all 100 calls return the same variant

  Scenario: Conversion event processing via BullMQ
    Given a running experiment with 1000 impressions
    When POST /sdk/v1/events with a valid conversion event
    Then the event is enqueued in BullMQ "sdk-events" queue
    And the worker processes the event within 30 seconds
    And the experiment_events table has a new record
    And the experiment_results table is updated on next aggregation run
```

### SDK

```gherkin
Feature: SDK Initialization

  Scenario: SDK fetches all flags on connect
    Given a valid server-side SDK key with 5 active flags
    When vault.connect() is called
    Then GET /sdk/v1/flags is called once
    And FlagStore contains 5 flags
    And WebSocket connection is established within 5 seconds

  Scenario: SDK evaluates flag without network call
    Given a connected SDK with flags loaded in FlagStore
    When vault.isEnabled("dark-mode", { userId: "usr_123" }) is called
    Then no HTTP requests are made
    And the result is returned in under 0.1ms

  Scenario: SDK event batching
    Given a connected SDK
    When vault.track() is called 30 times within 1 second
    Then no HTTP requests are made until either 50 events accumulate or 2 seconds pass
    And all 30 events are sent in a single POST to /sdk/v1/events
```

---

*End of FeatureVault PRD v1.0.0*  
*Next: System design deep-dive → Monorepo setup → Phase 1 build kickoff*
