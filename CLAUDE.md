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