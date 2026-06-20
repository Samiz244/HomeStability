import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { authApi } from './api/authApi.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hsg_user') || 'null')
    } catch {
      return null
    }
  })
  // Gate rendering until we've established a valid session. This guarantees every
  // data call from the contexts/pages below carries a session id, so plans and
  // conversations always persist — even before the user explicitly signs in.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (user) localStorage.setItem('hsg_user', JSON.stringify(user))
    else localStorage.removeItem('hsg_user')
  }, [user])

  const persistSession = ({ user: u, sessionId }) => {
    if (sessionId) localStorage.setItem('hsg_session_id', sessionId)
    setUser(u)
    return u
  }

  // Bootstrap a session on first load: reuse a still-valid one, otherwise create
  // a guest session transparently. /auth/me re-validates because in-memory mode
  // loses all sessions on a server restart (a stale localStorage id would 401).
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const existing = localStorage.getItem('hsg_session_id')
        if (existing) {
          const me = await authApi.getCurrentUser().catch(() => null)
          if (me?.user) {
            if (active) {
              // Adopt the server's user if we don't have one cached.
              setUser((prev) => prev || me.user)
            }
            return
          }
          // Session no longer valid (e.g. server restarted) — drop it.
          localStorage.removeItem('hsg_session_id')
        }
        // No valid session — establish a guest one so the app is usable and
        // persistent immediately. A later Google sign-in replaces it.
        const res = await authApi.signInAsGuest()
        if (active) persistSession(res)
      } catch {
        /* offline / API down — fall through; the app still works read-only */
      } finally {
        if (active) setReady(true)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      user,
      // A bootstrapped guest is a session, not a "real" identity. isAuthed stays
      // false for guests so the UI still invites a Google sign-in.
      isAuthed: Boolean(user) && user.provider !== 'guest',
      signInWithGoogle: async (idToken) =>
        persistSession(await authApi.signInWithGoogle(idToken)),
      signInAsGuest: async () => persistSession(await authApi.signInAsGuest()),
      signOut: async () => {
        try {
          await authApi.signOut()
        } catch {
          /* ignore network errors on sign out */
        }
        localStorage.removeItem('hsg_session_id')
        setUser(null)
        // Re-establish a guest session so the app stays usable after sign-out.
        try {
          persistSession(await authApi.signInAsGuest())
        } catch {
          /* ignore */
        }
      },
    }),
    [user],
  )

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafaf8] text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
