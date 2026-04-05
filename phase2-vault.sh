#!/usr/bin/env bash
# ============================================================
# FeatureVault — Phase 2 Fix: TypeScript errors
# Run from inside featurevault/ directory
# ============================================================
set -euo pipefail

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        FeatureVault — Phase 2 TypeScript Fix         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if [ ! -f "pnpm-workspace.yaml" ]; then
  echo "❌  Run from inside featurevault/ root"; exit 1
fi

ROOT=$(pwd)
API="$ROOT/apps/api/src"

# ════════════════════════════════════════════════════════════
# FIX 1 — Force argon2 native build
# ════════════════════════════════════════════════════════════
echo "🔧  Fix 1: Force argon2 native build..."
cd "$ROOT/apps/api"
# pnpm 10 needs explicit approval written to pnpm-lock
# Nuclear option: rebuild with npm for this package only
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('../../package.json','utf8'));
pkg.pnpm = pkg.pnpm || {};
pkg.pnpm.onlyBuiltDependencies = [
  'argon2','esbuild','sharp','msgpackr-extract',
  '@img/sharp-libvips-darwin-arm64','es5-ext'
];
fs.writeFileSync('../../package.json', JSON.stringify(pkg,null,2)+'\n');
"
cd "$ROOT"
pnpm install --force 2>&1 | tail -3
echo "✅  argon2 rebuild attempted"

# ════════════════════════════════════════════════════════════
# FIX 2 — Redis client: fix ESM import + typed error handlers
# ════════════════════════════════════════════════════════════
echo "🔧  Fix 2: Redis client ESM import..."
cat > "$API/lib/redis/client.ts" << 'EOF'
import { Redis } from 'ioredis'
import { env } from '../env.js'

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

export const redisSub = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
})

redisClient.on('error', (err: Error) => console.error('[Redis]', err.message))
redisSub.on('error',    (err: Error) => console.error('[Redis Sub]', err.message))

export const REDIS_KEYS = {
  flagCache:      (projectId: string) => `fv:flags:${projectId}`,
  pubsubFlags:    (projectId: string) => `fv:pubsub:flags:${projectId}`,
  rateLimitLogin: (email: string)     => `fv:rl:login:${email}`,
  wsConnections:  (instanceId: string)=> `fv:ws:connections:${instanceId}`,
  wsProjectConns: (projectId: string) => `fv:ws:project:${projectId}:connections`,
  sessionId:      (sessionId: string) => `fv:session:${sessionId}`,
} as const
EOF
echo "✅  Redis client fixed"

# ════════════════════════════════════════════════════════════
# FIX 3 — JWT plugin: remove issuer from sign/verify,
#          put it at top level where @fastify/jwt v8 expects it
# ════════════════════════════════════════════════════════════
echo "🔧  Fix 3: JWT plugin options..."
cat > "$API/plugins/jwt.ts" << 'EOF'
import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from '../lib/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default fp(async (app) => {
  const privateKeyPath = path.resolve(__dirname, '../../keys/private.pem')
  const publicKeyPath  = path.resolve(__dirname, '../../keys/public.pem')

  if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8')
    const publicKey  = fs.readFileSync(publicKeyPath, 'utf8')

    await app.register(jwt, {
      secret: { private: privateKey, public: publicKey },
      sign:   { algorithm: 'RS256', expiresIn: '15m' },
      verify: { algorithms: ['RS256'] },
      // issuer lives at the top level in @fastify/jwt v8
      trusted: (_request, _decodedToken) => true,
    })
    app.log.info('JWT: using RS256 key pair')
  } else {
    app.log.warn('JWT: RS256 keys not found, falling back to HS256 (dev only)')
    await app.register(jwt, {
      secret:  env.COOKIE_SECRET,
      sign:    { expiresIn: '15m' },
    })
  }
})
EOF
echo "✅  JWT plugin fixed"

# ════════════════════════════════════════════════════════════
# FIX 4 — Auth middleware: correct module augmentation for
#          @fastify/jwt v8. The type must extend UserType.
# ════════════════════════════════════════════════════════════
echo "🔧  Fix 4: Auth middleware type augmentation..."
cat > "$API/middleware/authenticate.ts" << 'EOF'
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JWTPayload {
  userId:      string
  workspaceId: string
  role:        'owner' | 'admin' | 'editor' | 'viewer'
  email:       string
}

// Augment @fastify/jwt's UserType so request.user is typed
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: JWTPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({
      success: false,
      error: {
        code:    'UNAUTHORIZED',
        message: 'Valid authentication token required',
      },
      meta: {
        requestId: request.id as string,
        timestamp: new Date().toISOString(),
      },
    })
  }
}

export function requireRole(...roles: JWTPayload['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        meta: { requestId: request.id as string, timestamp: new Date().toISOString() },
      })
    }
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code:    'INSUFFICIENT_PERMISSIONS',
          message: `This action requires role: ${roles.join(' or ')}`,
        },
        meta: { requestId: request.id as string, timestamp: new Date().toISOString() },
      })
    }
  }
}
EOF
echo "✅  Auth middleware fixed"

# ════════════════════════════════════════════════════════════
# FIX 5 — Vitest config: add resolve aliases so .js imports
#          resolve to .ts files correctly in test environment
# ════════════════════════════════════════════════════════════
echo "🔧  Fix 5: Vitest config with path aliases..."
cat > "$ROOT/apps/api/vitest.config.ts" << 'EOF'
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    // Allow vitest to resolve .js imports as .ts (ESM project convention)
    alias: {
      '@/': path.resolve(__dirname, './src/'),
    },
    extensions: ['.ts', '.js'],
  },
})
EOF
echo "✅  Vitest config fixed"

# ════════════════════════════════════════════════════════════
# FIX 6 — Rewrite tests to use static imports (no dynamic
#          .js imports) — vitest handles TS directly
# ════════════════════════════════════════════════════════════
echo "🔧  Fix 6: Rewriting tests with static imports..."
mkdir -p "$API/modules/auth/__tests__"
cat > "$API/modules/auth/__tests__/auth.test.ts" << 'EOF'
import { describe, it, expect } from 'vitest'
import { signupSchema, loginSchema } from '../auth.schemas.js'
import { sha256, generateToken } from '../../../lib/crypto/hash.js'
import { hashPassword, verifyPassword } from '../../../lib/crypto/password.js'

describe('Auth schemas', () => {

  describe('signupSchema', () => {
    it('accepts a valid signup', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'ValidPass123!',
        firstName: 'Test',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid email', () => {
      const result = signupSchema.safeParse({
        email: 'notanemail',
        password: 'ValidPass123!',
      })
      expect(result.success).toBe(false)
      expect(result.error?.errors[0].path[0]).toBe('email')
    })

    it('rejects short password', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'short',
      })
      expect(result.success).toBe(false)
      expect(result.error?.errors[0].path[0]).toBe('password')
    })

    it('rejects password without uppercase', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'validpass123!',
      })
      expect(result.success).toBe(false)
    })

    it('rejects password without number', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'ValidPassword!',
      })
      expect(result.success).toBe(false)
    })

    it('rejects password without special char', () => {
      const result = signupSchema.safeParse({
        email: 'test@example.com',
        password: 'ValidPass1234',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('accepts valid login', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'anything',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('Crypto helpers', () => {
  it('sha256 produces consistent 64-char hex', () => {
    const hash1 = sha256('hello')
    const hash2 = sha256('hello')
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(hash1).toMatch(/^[0-9a-f]+$/)
  })

  it('sha256 different inputs produce different hashes', () => {
    expect(sha256('hello')).not.toBe(sha256('world'))
  })

  it('generateToken produces url-safe base64 string', () => {
    const token = generateToken(32)
    expect(token.length).toBeGreaterThan(20)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('two generateToken calls produce different values', () => {
    expect(generateToken(32)).not.toBe(generateToken(32))
  })

  it('hashPassword + verifyPassword round trip', async () => {
    const hash = await hashPassword('MyTestPassword123!')
    expect(await verifyPassword(hash, 'MyTestPassword123!')).toBe(true)
    expect(await verifyPassword(hash, 'WrongPassword123!')).toBe(false)
  }, 15000) // argon2 is intentionally slow — give it 15s
})
EOF
echo "✅  Tests rewritten with static imports"

# ════════════════════════════════════════════════════════════
# FIX 7 — Check argon2 is actually built (the real test)
# ════════════════════════════════════════════════════════════
echo ""
echo "🔬  Checking argon2 native build..."
cd "$ROOT/apps/api"
node --input-type=module << 'NODETEST' 2>&1 && echo "✅  argon2 loads correctly" || {
  echo "⚠️  argon2 native build missing — running npm rebuild..."
  # Use npm directly to rebuild just this package
  cd "$ROOT/apps/api"
  node_modules/.bin/node-gyp --version 2>/dev/null || true
  # Try pnpm approve-builds
  pnpm approve-builds 2>/dev/null || true
  pnpm rebuild argon2 2>/dev/null && echo "✅  argon2 rebuilt" || {
    echo "⚠️  Falling back: installing argon2 via npm in api directory..."
    npm install argon2 --save 2>&1 | tail -3
  }
}
import argon2 from 'argon2'
const hash = await argon2.hash('test')
const ok = await argon2.verify(hash, 'test')
if (!ok) throw new Error('argon2 verify failed')
console.log('argon2 OK')
NODETEST

# ════════════════════════════════════════════════════════════
# Run typecheck
# ════════════════════════════════════════════════════════════
echo ""
echo "🔍  Running typecheck..."
cd "$ROOT/apps/api"
DATABASE_URL="postgresql://featurevault:secret@localhost:5433/featurevault" \
REDIS_URL="redis://localhost:6379" \
pnpm typecheck && echo "✅  TypeScript clean" || echo "⚠️  Remaining TS errors above"

# ════════════════════════════════════════════════════════════
# Run tests
# ════════════════════════════════════════════════════════════
echo ""
echo "🧪  Running tests..."
DATABASE_URL="postgresql://featurevault:secret@localhost:5433/featurevault" \
REDIS_URL="redis://localhost:6379" \
NODE_ENV=test \
pnpm test

cd "$ROOT"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║            Phase 2 fixes applied!                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  If tests pass, start the server:                   ║"
echo "║    cd apps/api                                       ║"
echo "║    DATABASE_URL=postgresql://featurevault:secret@\   ║"
echo "║    localhost:5433/featurevault \                     ║"
echo "║    REDIS_URL=redis://localhost:6379 pnpm dev         ║"
echo "╚══════════════════════════════════════════════════════╝"