import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client.js'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// Works for both:
//   tsx src/lib/db/migrate.ts  → __dirname = apps/api/src/lib/db
//   node dist/lib/db/migrate.js → __dirname = apps/api/dist/lib/db
// Both need to go up 3 levels to reach apps/api, then into drizzle
const migrationsFolder = path.resolve(__dirname, '../../../drizzle')

console.log('🔄  Running migrations...')
console.log('    folder:', migrationsFolder)
await migrate(db, { migrationsFolder })
console.log('✅  Migrations complete')
await pool.end()
