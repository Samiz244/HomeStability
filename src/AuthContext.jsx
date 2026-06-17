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

  useEffect(() => {
    if (user) localStorage.setItem('hsg_user', JSON.stringify(user))
    else localStorage.removeItem('hsg_user')
  }, [user])

  const persistSession = ({ user: u, sessionId }) => {
    if (sessionId) localStorage.setItem('hsg_session_id', sessionId)
    setUser(u)
    return u
  }

  const value = useMemo(
    () => ({
      user,
      isAuthed: Boolean(user),
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
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
