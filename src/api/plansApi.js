import { apiCall } from './config.js'

export const plansApi = {
  list: () => apiCall('/plans'),

  generate: (situation) =>
    apiCall('/plans/generate', { method: 'POST', body: JSON.stringify({ situation }) }),

  get: (planId) => apiCall(`/plans/${planId}`),

  updatePlan: (planId, userMessage) =>
    apiCall(`/plans/${planId}/update`, {
      method: 'POST',
      body: JSON.stringify({ userMessage }),
    }),

  // Save a user-confirmed plan draft. Pass planId to update an existing plan.
  confirmDraft: ({ planDraft, situation = {}, planId = null }) =>
    apiCall('/plans/confirm-draft', {
      method: 'POST',
      body: JSON.stringify({ planDraft, situation, planId }),
    }),
}
