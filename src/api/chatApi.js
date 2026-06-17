import { apiCall } from './config.js'

export const chatApi = {
  // messages: [{ role: 'user' | 'assistant', content: string }]
  // conversationId: reuse an existing conversation (omit to start a new one)
  send: (messages, conversationId = null) =>
    apiCall('/chat', { method: 'POST', body: JSON.stringify({ messages, conversationId }) }),
}
