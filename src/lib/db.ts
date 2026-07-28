import pg from 'pg'
import { env } from '@/lib/env'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL })

// `Pool` extends `EventEmitter` and emits `'error'` whenever an idle client
// fails in the background (a Postgres restart, a proxy connection reset).
// With no listener, that is an unhandled `'error'` event and Node terminates
// the process — this never fires under test or in dev, only in production
// against a real, occasionally-restarting database.
pool.on('error', (error) => {
  console.error('unexpected error on idle postgres client:', error)
})
