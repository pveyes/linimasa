import { createClient } from '@libsql/client'
import pg from 'pg'

let pgPool: pg.Pool

export interface Database {
  execute: <T>({ sql, args }: { sql: string, args?: any[] }) => Promise<T>
  migrate: (sql: string) => Promise<any>
}

export async function getPGDatabse(dbUrl: string): Promise<Database> {
  const pool = new pg.Pool(getPgConfig(dbUrl))
  pgPool = pool
  const db: Database = {
    // @ts-ignore
    execute: async ({ sql, args }: { sql: string, args?: any[] }) => {
      const client = await pool.connect()
      try {
  
        // replace ? with $1, $2, etc
        const pls = []
        sql = sql.replace(/\?/g, () => `$${pls.push(undefined)}`)


        if (sql.includes('SELECT')) {
          const result = await client.query(sql, args)
          return result.rows
        }
        
        args = args || []
        if (Array.isArray(args[0])) {
          try {
            await client.query('BEGIN')
            for (const a of args) {
              await client.query(sql, a)
            }
            await client.query('COMMIT')
            return Promise.resolve()
          } catch (e) {
            await client.query('ROLLBACK')
          }
        }
        
        return client.query(sql, args)
      } finally {
        client.release()
      }
    },
    migrate: (sql: string) => pool.query(sql)
  }

  return db;
}

function getPgConfig(url: string): pg.ClientConfig {
  const params = new URL(url)
  return {
    user: params.username,
    password: params.password,
    host: params.hostname,
    port: parseInt(params.port),
    database: params.pathname.split('/')[1],
  }
}

process.on('SIGINT', async () => {
  if (!pgPool) {
    return process.exit(0)
  }

  await pgPool.end()
  process.exit(0)
})

export function getSqliteDatabase(): Database {
  const client = createClient({
    url: "file:./local.db",
  })

  // Allows the other process to read from the database while we're writing to it
  client.execute(`PRAGMA journal_mode = WAL;`);

  const db: Database = {
    // @ts-ignore
    execute: async ({ sql, args }: { sql: string, args?: any[] }) => {
      if (sql.includes('SELECT')) {
        const result = await client.execute({ sql, args: args || [] })
        return result.rows
      }

      args = args || []
      if (Array.isArray(args[0])) {
        return client.batch(
          args.map((a) => ({ sql, args: a })),
        )
      }

      return client.execute({sql, args: args || [] })
    },
    migrate: async (sql: string) => {
      await client.executeMultiple(sql)
    }
  }

  return db
}
