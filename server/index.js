import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRouter from './routes/auth.js'
import chatRouter from './routes/chat.js'
import conversationsRouter from './routes/conversations.js'
import resourcesRouter from './routes/resources.js'
import plansRouter from './routes/plans.js'
import { isGroqEnabled } from './services/groqService.js'
import { dbConfigured, initDb, isDbReady } from './database/db.js'
import { attachUser } from './middleware/attachUser.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Health / status — lets the frontend know if real AI and persistence are live.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', aiEnabled: isGroqEnabled(), dbEnabled: isDbReady() })
})

app.use('/api/auth', authRouter)
// attachUser resolves the session -> req.user for all per-user data routes.
app.use('/api/chat', attachUser, chatRouter)
app.use('/api/conversations', attachUser, conversationsRouter)
app.use('/api/resources', attachUser, resourcesRouter)
app.use('/api/plans', attachUser, plansRouter)

// Centralized error handler so route handlers can throw freely.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server error]', err)
  res.status(500).json({ error: 'Internal server error', detail: err.message })
})

// Probe Postgres before listening. On failure we run in fallback mode.
const dbUp = await initDb()

app.listen(PORT, () => {
  console.log(`Housing Stability Guide API listening on http://localhost:${PORT}`)
  console.log(`  AI mode: ${isGroqEnabled() ? 'Groq (live)' : 'fallback (no GROQ_API_KEY set)'}`)
  console.log(
    `  Data mode: ${
      dbUp
        ? 'Postgres (live)'
        : dbConfigured()
          ? 'fallback (DATABASE_URL set but unreachable)'
          : 'fallback (in-memory; no DATABASE_URL set)'
    }`,
  )
})
