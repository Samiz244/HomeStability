import express from 'express'
import { conversationService } from '../services/conversationService.js'

const router = express.Router()

function isValidUUID(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

// List the authenticated user's conversations (newest first). [] when signed out.
router.get('/', async (req, res) => {
  try {
    if (!req.user?.id) return res.json([])
    res.json(await conversationService.getUserConversations(req.user.id))
  } catch (err) {
    console.error('[conversations:list]', err.message)
    res.status(500).json({ error: 'Could not list conversations' })
  }
})

// A single conversation with its messages — only if owned by the user.
router.get('/:id', async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    return res.status(404).json({ error: 'Conversation not found' })
  }
  try {
    const conv = await conversationService.getConversationWithMessages(req.params.id)
    if (!conv || (req.user?.id && conv.user_id !== req.user.id)) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    res.json(conv)
  } catch (err) {
    console.error('[conversations:get]', err.message)
    res.status(404).json({ error: 'Conversation not found' })
  }
})

export default router
