import { randomUUID } from 'node:crypto'
import { isDbReady, query } from '../database/db.js'

// Conversation/message persistence. Postgres when a DATABASE_URL is configured,
// otherwise an in-memory store so chat history (and the "Share your situation"
// progress step + sidebar recent-conversations) works with zero setup — the
// same graceful-degradation pattern used for plans. Both modes return the same
// snake_case shape (user_id, created_at, updated_at) the routes/frontend expect.

/* -------------------------- in-memory fallback -------------------------- */
const memConversations = new Map() // id -> { id, user_id, title, created_at, updated_at }
const memMessages = new Map() // conversationId -> [{ id, conversation_id, role, content, created_at }]

export const conversationService = {
  createConversation: async (userId, title) => {
    if (!isDbReady()) {
      const now = new Date().toISOString()
      // UUID id so GET /conversations/:id (which validates UUIDs) accepts it.
      const conv = { id: randomUUID(), user_id: userId, title, created_at: now, updated_at: now }
      memConversations.set(conv.id, conv)
      memMessages.set(conv.id, [])
      return conv
    }
    const { rows } = await query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title],
    )
    return rows[0]
  },

  getUserConversations: async (userId) => {
    if (!isDbReady()) {
      return Array.from(memConversations.values())
        .filter((c) => c.user_id === userId)
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)) // newest first
    }
    const { rows } = await query(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId],
    )
    return rows
  },

  getConversationWithMessages: async (conversationId) => {
    if (!isDbReady()) {
      const conv = memConversations.get(conversationId)
      if (!conv) return null
      return { ...conv, messages: memMessages.get(conversationId) || [] }
    }
    const conv = await query('SELECT * FROM conversations WHERE id = $1', [conversationId])
    if (conv.rows.length === 0) return null
    const messages = await query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at',
      [conversationId],
    )
    return { ...conv.rows[0], messages: messages.rows }
  },

  addMessage: async (conversationId, role, content) => {
    if (!isDbReady()) {
      const conv = memConversations.get(conversationId)
      if (!conv) return null
      const now = new Date().toISOString()
      conv.updated_at = now
      const msg = { id: randomUUID(), conversation_id: conversationId, role, content, created_at: now }
      const list = memMessages.get(conversationId) || []
      list.push(msg)
      memMessages.set(conversationId, list)
      return msg
    }
    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId])
    const { rows } = await query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [conversationId, role, content],
    )
    return rows[0]
  },
}
