# FeatureVault

> Self-hostable feature flags and A/B testing platform with sub-millisecond SDK evaluation.

## Architecture
- **API**: Fastify v4 + Drizzle ORM + PostgreSQL 16 + Redis 7
- **Web**: Next.js 15 (App Router)
- **SDK**: `featurevault-node` npm package (zero-network-call evaluation via WebSocket sync)
- **Queue**: BullMQ (event processing, aggregation, emails)

## Quick Start (Development)

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Install deps
pnpm install

# 3. Generate JWT keys
mkdir -p apps/api/keys
openssl genrsa -out apps/api/keys/private.pem 2048
openssl rsa -in apps/api/keys/private.pem -pubout -out apps/api/keys/public.pem

# 4. Set up env
cp .env.example .env
# Edit .env — DATABASE_URL and REDIS_URL are already correct for local docker

# 5. Run migrations
pnpm db:migrate

# 6. Start API
pnpm dev:api

# 7. Start Web (separate terminal)
pnpm dev:web
```

## Services
| Service  | URL                     |
|----------|-------------------------|
| API      | http://localhost:4000   |
| Web      | http://localhost:3000   |
| Mailhog  | http://localhost:8025   |
| Postgres | localhost:5432          |
| Redis    | localhost:6379          |

## Health Check
```bash
curl http://localhost:4000/health
```
# FeatureVault
