import express from 'express'
import { authService } from '../services/authService.js'

const router = express.Router()

// Real Google sign-in. The ONLY trusted input is the Google ID token, which is
// cryptographically verified server-side. A client-supplied user object is
// never trusted.
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body || {}
    if (!idToken) return res.status(400).json({ error: 'Missing idToken' })

    const profile = await authService.verifyGoogleToken(idToken)
    const user = await authService.getOrCreateUser({
      email: profile.email,
      name: profile.name,
      provider: 'google',
      googleId: profile.googleId,
    })
    const sessionId = await authService.startSession(user.id)
    res.json({ user, sessionId })
  } catch (err) {
    console.error('Google auth failed:', err.message)
    res.status(401).json({ error: 'Invalid Google token' })
  }
})

router.post('/guest', async (_req, res) => {
  const user = await authService.signInAsGuest()
  const sessionId = await authService.startSession(user.id)
  res.json({ user, sessionId })
})

router.post('/logout', async (req, res) => {
  await authService.signOut(req.body?.sessionId || req.headers['x-session-id'])
  res.json({ ok: true })
})

router.get('/me', async (req, res) => {
  const user = await authService.getCurrentUser(req.headers['x-session-id'])
  res.json({ user })
})

export default router
