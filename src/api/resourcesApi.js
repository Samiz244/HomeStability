import { apiCall } from './config.js'

export const resourcesApi = {
  list: () => apiCall('/resources'),

  get: (id) => apiCall(`/resources/${id}`),

  byCategory: (category) => apiCall(`/resources/category/${encodeURIComponent(category)}`),

  search: (query) =>
    apiCall('/resources/search', { method: 'POST', body: JSON.stringify({ query }) }),

  recommend: (situation) =>
    apiCall('/resources/recommend', { method: 'POST', body: JSON.stringify({ situation }) }),

  ask: (id, question) =>
    apiCall(`/resources/${id}/ask`, { method: 'POST', body: JSON.stringify({ question }) }),

  // Saved resources (scoped to the authenticated user by the backend session).
  listSaved: () => apiCall('/resources/saved'),
  save: (id) => apiCall(`/resources/${id}/save`, { method: 'POST', body: '{}' }),
  unsave: (id) => apiCall(`/resources/${id}/save`, { method: 'DELETE' }),
}
