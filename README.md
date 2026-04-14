# FeatureVault

> Self-hostable feature flags and A/B testing platform with sub-millisecond SDK evaluation.

[![CI](https://github.com/nikhiilraj/FeatureVault/actions/workflows/ci.yml/badge.svg)](https://github.com/nikhiilraj/FeatureVault/actions)
[![npm](https://img.shields.io/npm/v/featurevault-node)](https://npmjs.com/package/featurevault-node)

---

## What is FeatureVault?

FeatureVault lets engineering teams ship code safely by decoupling deployments from releases. The SDK evaluates flags at **sub-millisecond latency** using a local in-memory store that stays in sync with the server via a persistent WebSocket — zero network calls per flag check, ever.

```
Flag evaluation latency: 0.0003ms p99
Flag propagation (change → SDK): < 100ms p95
REST API reads: < 50ms p95
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (TLS termination)                   │
└──────────────────────┬──────────────────┬───────────────────┘
                       │                  │
              ┌────────┴──────┐  ┌────────┴──────┐
              │  Next.js 15   │  │  Fastify v4   │
              │  Dashboard    │  │  REST + WS    │
              │  Port 3000    │  │  Port 4000    │
              └───────────────┘  └───────┬───────┘
                                         │
                               ┌─────────┴──────────┐
                               │                    │
                      ┌────────┴──────┐   ┌─────────┴──────┐
                      │  PostgreSQL   │   │    Redis 7      │
                      │  16 (primary) │   │  cache+pubsub   │
                      └───────────────┘   └────────────────┘
```

**Stack:** Fastify v4 · Next.js 15 · PostgreSQL 16 · Redis 7 · BullMQ · Drizzle ORM · TypeScript

**Security:** Argon2id · RS256 JWT · Refresh token rotation · Replay attack detection · CSRF protection · Rate limiting

---

## Quick start (5 minutes)

```bash
# 1. Clone
git clone https://github.com/nikhiilraj/FeatureVault
cd featurevault

# 2. Start infrastructure
docker compose up -d

# 3. Install dependencies
pnpm install

# 4. Generate JWT keys
mkdir -p apps/api/keys
openssl genrsa -out apps/api/keys/private.pem 2048
openssl rsa -in apps/api/keys/private.pem -pubout -out apps/api/keys/public.pem

# 5. Configure environment
cp .env.example .env

# 6. Run migrations
pnpm db:migrate

# 7. Start API
DATABASE_URL=postgresql://featurevault:secret@localhost:5433/featurevault \
REDIS_URL=redis://localhost:6379 pnpm dev:api

# 8. Start dashboard (new terminal)
cd apps/web && pnpm dev

# Open http://localhost:3000 and sign up
```

---

## SDK usage

```bash
npm install featurevault-node
```

```typescript
import { FeatureVault } from 'featurevault-node'

const vault = new FeatureVault({
  apiKey: 'fv_live_your_sdk_key',
  apiUrl: 'https://your-featurevault-instance.com',
})

await vault.connect()  // fetches flags, opens WebSocket

// Boolean flag — sub-millisecond, no network call
if (vault.isEnabled('new-checkout-flow', { userId: user.id, plan: user.plan })) {
  return renderNewCheckout()
}

// String flag with default
const buttonColor = vault.getStringFlag('button-color', { userId }, 'blue')

// A/B experiment variant assignment (deterministic)
const variant = vault.getVariant('checkout-experiment', { userId: user.id })
// variant === 'control' | 'treatment' | null

// Track conversion event
vault.track('purchase_completed', {
  userId:        user.id,
  experimentKey: 'checkout-experiment',
  value:         order.total,
})

await vault.close()
```

---

## How flag evaluation works

```
vault.isEnabled('dark-mode', { userId: 'usr_123', plan: 'pro' })

1. FlagStore.get('dark-mode')         — Map lookup, ~0.001ms
2. flag.status === 'killed'?          — return false immediately
3. flag.status === 'inactive'?        — return defaultValue
4. targetingEnabled === false?        — return defaultValue
5. RuleEngine.evaluate(flag, context)
   ├── Rule 1: plan eq 'pro'          — match → rollout check
   │   └── MurmurHash3('usr_123dark-mode') → 23% → within 100% → true
   └── return true
Total: ~0.0003ms, zero network calls
```

---

## API reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/auth/signup` | Create account |
| `GET`  | `/v1/auth/verify-email?token=` | Verify email |
| `POST` | `/v1/auth/login` | Login → JWT + cookie |
| `POST` | `/v1/auth/refresh` | Rotate refresh token |
| `POST` | `/v1/auth/logout` | Invalidate session |
| `GET`  | `/v1/auth/me` | Current user |

### Feature flags
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`    | `/v1/projects/:id/flags` | List flags |
| `POST`   | `/v1/projects/:id/flags` | Create flag |
| `PATCH`  | `/v1/projects/:id/flags/:id` | Update flag |
| `PATCH`  | `/v1/projects/:id/flags/:id/status` | Toggle/kill flag |
| `PUT`    | `/v1/projects/:id/flags/:id/rules` | Upsert targeting rules |
| `GET`    | `/v1/projects/:id/flags/:id/versions` | Version history |
| `DELETE` | `/v1/projects/:id/flags/:id` | Soft delete |

### Experiments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/v1/projects/:id/experiments` | List experiments |
| `POST` | `/v1/projects/:id/experiments` | Create experiment |
| `POST` | `/v1/projects/:id/experiments/:id/launch` | Launch |
| `POST` | `/v1/projects/:id/experiments/:id/pause` | Pause |
| `POST` | `/v1/projects/:id/experiments/:id/stop` | Stop + declare winner |
| `GET`  | `/v1/projects/:id/experiments/:id/results` | Statistical results |

### SDK endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET`  | `/sdk/v1/flags` | `X-API-Key` | Fetch all flags for project |
| `WS`   | `/sdk/v1/ws`   | `X-API-Key` | Real-time flag updates |
| `POST` | `/sdk/v1/events` | `X-API-Key` | Track conversion events |

---

## Performance benchmarks

| Metric | Result | Target |
|--------|--------|--------|
| SDK flag evaluation | **0.0003ms** p99 | < 0.1ms |
| Flag propagation (change → SDK) | **< 100ms** p95 | < 100ms |
| REST API reads | **< 50ms** p95 | < 50ms |
| MurmurHash3 distribution | **±1.2%** at 10% rollout | ±2% |

Tested with 10,000 simulated users across 1,000 flag evaluations.

---

## Security

- **Passwords**: Argon2id (64MB memory, 3 iterations, 4 parallelism)
- **JWT**: RS256 asymmetric signing — SDK verifies without holding the secret
- **Refresh tokens**: Single-use rotation with replay attack detection (all sessions invalidated on reuse)
- **SDK keys**: SHA-256 hashed in database — raw key shown once, never stored
- **Rate limiting**: Redis-backed sliding window — 5 login attempts per email per 15 minutes
- **CSRF**: Double-submit cookie pattern on all state-changing requests
- **Cookies**: HttpOnly + Secure + SameSite=Strict on refresh token

---

## Project structure

```
featurevault/
├── apps/
│   ├── api/          — Fastify v4 REST API + WebSocket
│   └── web/          — Next.js 15 dashboard
├── packages/
│   ├── shared/       — Shared TypeScript types
│   └── sdk/          — featurevault-node npm package
├── .github/
│   └── workflows/    — CI/CD pipelines
└── docker-compose.yml
```

---

## Self-hosting with Docker Compose

```bash
# Production deployment
cp .env.production.example .env.production
# Edit .env.production with your values

docker compose -f docker-compose.prod.yml up -d
```

---

## License

MIT
