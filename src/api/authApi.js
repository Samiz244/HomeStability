import { apiCall } from './config.js'

export const authApi = {
  // Sends the verified Google ID token (JWT credential) to the backend.
  signInWithGoogle: (idToken) =>
    apiCall('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),

  signInAsGuest: () => apiCall('/auth/guest', { method: 'POST', body: JSON.stringify({}) }),

  signOut: () => {
    const sessionId = localStorage.getItem('hsg_session_id')
    return apiCall('/auth/logout', { method: 'POST', body: JSON.stringify({ sessionId }) })
  },

  getCurrentUser: () => apiCall('/auth/me'),
}
