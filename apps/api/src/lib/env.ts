import { z } from 'zod'

const schema = z.object({
  NODE_ENV:         z.enum(['development', 'test', 'production']).default('development'),
  API_PORT:         z.coerce.number().default(4000),
  DATABASE_URL:     z.string().url(),
  REDIS_URL:        z.string().url().default('redis://localhost:6379'),
  COOKIE_SECRET:    z.string().min(32).default('change-me-in-production-min-32-chars!!'),
  CORS_ORIGIN:      z.string().default('http://localhost:3000'),
  LOG_LEVEL:        z.enum(['trace','debug','info','warn','error']).default('info'),
  JWT_ISSUER:       z.string().default('featurevault'),
  SMTP_HOST:        z.string().default('localhost'),
  SMTP_PORT:        z.coerce.number().default(1025),
  SMTP_FROM:        z.string().default('noreply@featurevault.dev'),

  // Resend — preferred over SMTP in production
  RESEND_API_KEY: z.string().optional(),

  // Public URLs for email links
  WEB_URL: z.string().default('http://localhost:3000'),
  API_URL: z.string().default('http://localhost:4000'),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌  Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
