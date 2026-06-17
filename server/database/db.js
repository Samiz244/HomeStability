import pg from 'pg'

// Postgres is OPTIONAL. When DATABASE_URL is set and reachable, services
// persist to Postgres. Otherwise the app runs on in-memory/mock data —
// the same graceful-degradation pattern used for Groq. This keeps the app
// working with zero setup while supporting real persistence when configured.

const connectionString = process.env.DATABASE_URL
let pool = null
let ready = false

export function dbConfigured() {
  return Boolean(connectionString)
}

export function isDbReady() {
  return ready
}

function getPool() {
  if (!connectionString) return null
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
    pool.on('error', (err) => console.error('[db] idle client error', err.message))
  }
  return pool
}

// Probe the connection at startup. Returns true if Postgres is usable.
// On failure we log and fall back to in-memory mode instead of crashing.
export async function initDb() {
  if (!connectionString) {
    ready = false
    return false
  }
  try {
    await getPool().query('SELECT 1')
    ready = true
    return true
  } catch (err) {
    ready = false
    console.warn(`[db] DATABASE_URL set but connection failed — running in fallback mode: ${err.message}`)
    return false
  }
}

export const query = (text, params) => {
  const p = getPool()
  if (!p) throw new Error('Database not configured')
  return p.query(text, params)
}

export const getClient = () => {
  const p = getPool()
  if (!p) throw new Error('Database not configured')
  return p.connect()
}

export default { query, getClient, initDb, isDbReady, dbConfigured }
