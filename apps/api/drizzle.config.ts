import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

config({ path: '../../.env' })

export default defineConfig({
  schema:    './src/lib/db/schema.ts',
  out:       './drizzle',
  dialect:   'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://featurevault:secret@localhost:5432/featurevault',
  },
  verbose: true,
  strict:  true,
})
