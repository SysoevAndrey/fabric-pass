import pg from 'pg'
import { env } from '@/lib/env'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
