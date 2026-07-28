import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))

/** Applies every unapplied .sql file in this directory, in filename order. */
export async function migrate(databaseUrl: string): Promise<string[]> {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const { rows } = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations')
    const done = new Set(rows.map((r) => r.filename))

    const files = (await readdir(here)).filter((f) => f.endsWith('.sql')).sort()
    const applied: string[] = []

    for (const file of files) {
      if (done.has(file)) continue
      const sql = await readFile(join(here, file), 'utf8')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        applied.push(file)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    return applied
  } finally {
    await pool.end()
  }
}

if (import.meta.filename === process.argv[1]) {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const applied = await migrate(url)
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply')
}
