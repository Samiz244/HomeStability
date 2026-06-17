import { apiCall } from './config.js'

export const conversationsApi = {
  // The signed-in user's conversations, newest first ([] when signed out).
  list: () => apiCall('/conversations'),

  // A single conversation with its persisted messages.
  get: (id) => apiCall(`/conversations/${id}`),
}
