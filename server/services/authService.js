import { OAuth2Client } from 'google-auth-library'
import { isDbReady, query } from '../database/db.js'

const GOOGLE_CLIENT_ID =
  '1001341600089-c817lvkbqstnsqomii48fqaf123p1gg2.apps.googleusercontent.com'
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

// Sessions persist to Postgres when available (so logins survive restarts);
// an in-memory map is used only in DB-less fallback mode.
const memSessions = new Map() // sessionId -> userId

function newSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const authService = {
  // Verify a Google ID token (a signed JWT). Throws if invalid/expired. The
  // returned profile is extracted from Google's signed payload — it is the ONLY
  // trusted source of identity. Never trust a user object sent by the client.
  verifyGoogleToken: async (idToken) => {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    const payload = ticket.getPayload()
    return {
      email: payload.email,
      name: payload.name || payload.email,
      googleId: payload.sub, // stable Google user id
      picture: payload.picture,
    }
  },

  signInAsGuest: async () => {
    const profile = { name: 'Guest User', email: null, provider: 'guest' }
    return isDbReady()
      ? authService.getOrCreateUser(profile)
      : { id: 'guest-' + Date.now(), ...profile }
  },

  // Look up an existing user by email (stable across logins) or create one.
  // Guests have no email and always get a fresh row.
  getOrCreateUser: async ({ email, name, provider, googleId = null }) => {
    if (!isDbReady()) {
      return { id: (provider === 'guest' ? 'guest-' : 'user-') + Date.now(), name, email, provider }
    }
    if (email) {
      const existing = await query('SELECT * FROM users WHERE email = $1', [email])
      if (existing.rows.length > 0) {
        const user = existing.rows[0]
        if (googleId && !user.google_id) {
          await query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, user.id])
        }
        return user
      }
    }
    const created = await query(
      'INSERT INTO users (name, email, provider, google_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, provider, googleId],
    )
    return created.rows[0]
  },

  // Create a session for a user id. Returns the new session id.
  startSession: async (userId) => {
    const sessionId = newSessionId()
    if (isDbReady()) {
      await query('INSERT INTO sessions (id, user_id) VALUES ($1, $2)', [sessionId, userId])
    } else {
      memSessions.set(sessionId, userId)
    }
    return sessionId
  },

  // Resolve a session id -> the full user record (or null).
  getCurrentUser: async (sessionId) => {
    if (!sessionId) return null
    if (isDbReady()) {
      const { rows } = await query(
        'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = $1',
        [sessionId],
      )
      return rows[0] || null
    }
    const userId = memSessions.get(sessionId)
    return userId ? { id: userId } : null
  },

  signOut: async (sessionId) => {
    if (!sessionId) return { ok: true }
    if (isDbReady()) await query('DELETE FROM sessions WHERE id = $1', [sessionId])
    else memSessions.delete(sessionId)
    return { ok: true }
  },

  getUserById: async (userId) => {
    if (!isDbReady()) return null
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId])
    return rows[0] || null
  },
}
