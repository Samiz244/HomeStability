import { isDbReady, query } from '../database/db.js'

// Conversation/message persistence. Available for future use — it is NOT wired
// into the chat route, because the current /api/chat contract is stateless
// ({ messages } in, { reply, ... } out) and the frontend does not send a
// conversationId/userId. Wiring it in would require frontend changes, which
// Phase 2 explicitly forbids. Provided here so the persistence layer is
// complete and ready when conversation history is added to the UI.
//
// In fallback mode (no DB) these are no-ops that return empty results.
export const conversationService = {
  createConversation: async (userId, title) => {
    if (!isDbReady()) return null
    const { rows } = await query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title],
    )
    return rows[0]
  },

  getUserConversations: async (userId) => {
    if (!isDbReady()) return []
    const { rows } = await query(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId],
    )
    return rows
  },

  getConversationWithMessages: async (conversationId) => {
    if (!isDbReady()) return null
    const conv = await query('SELECT * FROM conversations WHERE id = $1', [conversationId])
    if (conv.rows.length === 0) return null
    const messages = await query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at',
      [conversationId],
    )
    return { ...conv.rows[0], messages: messages.rows }
  },

  addMessage: async (conversationId, role, content) => {
    if (!isDbReady()) return null
    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId])
    const { rows } = await query(
      'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [conversationId, role, content],
    )
    return rows[0]
  },
}
