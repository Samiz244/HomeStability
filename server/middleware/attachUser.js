import { authService } from '../services/authService.js'

// Resolves the X-Session-Id header to the authenticated user and attaches it
// as req.user (or null). Routes that scope data per user read req.user.id.
// The user is derived only from a server-issued session — never from a user
// object sent by the client.
export async function attachUser(req, _res, next) {
  try {
    const sessionId = req.headers['x-session-id']
    req.user = sessionId ? await authService.getCurrentUser(sessionId) : null
  } catch {
    req.user = null
  }
  next()
}
