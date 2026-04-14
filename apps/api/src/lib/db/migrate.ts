import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client.js'

console.log('🔄  Running migrations...')
await migrate(db, { migrationsFolder: new URL('../../../../drizzle', import.meta.url).pathname })
console.log('✅  Migrations complete')
await pool.end()
