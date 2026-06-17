// Base path for the API. In dev, Vite proxies /api -> http://localhost:3001.
// Override with VITE_API_URL for other environments.
export const API_BASE = import.meta.env.VITE_API_URL || '/api'

function sessionId() {
  return localStorage.getItem('hsg_session_id') || ''
}

/**
 * Thin fetch wrapper. Adds JSON headers, the session id, and unified errors.
 */
export async function apiCall(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId(),
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json())?.error || ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }

  if (res.status === 204) return null
  return res.json()
}
