import * as mockData from '../data/resources.js' // optional fallback data (may be empty)
import { matchingService } from './matchingService.js'
import { isDbReady, query } from '../database/db.js'

// Postgres is the source of truth. The in-memory dataset is only a DB-less
// fallback; it may be empty (the module is intentionally commented out), so we
// tolerate a missing export rather than failing to load.
const mockResources = mockData.resources || []

// All resource retrieval flows through this service. It uses Postgres when
// available and falls back to the in-memory dataset otherwise. Return shapes
// are identical in both modes so routes and the frontend never change.

// In-memory saved-resources store, used only in fallback mode.
const savedByUser = new Map() // userId -> Set<resourceId>

// Map a DB row to the API resource shape. Flat columns are authoritative for
// scalar fields (so live edits to the table surface immediately); the rich
// `data` JSONB supplies only the UI-extra fields (metadata, eligibility list,
// howToApply, contact, verified, support).
function toResource(row) {
  if (!row) return null
  if (!row.data) return row
  return {
    ...row.data,
    id: row.id,
    name: row.name,
    category: row.category,
    provider: row.provider,
    description: row.description,
    website: row.website,
  }
}

export const resourceService = {
  getAllResources: async () => {
    if (isDbReady()) {
      const { rows } = await query('SELECT * FROM resources ORDER BY id')
      return rows.map(toResource)
    }
    return mockResources
  },

  getResourceById: async (id) => {
    if (!Number.isInteger(Number(id))) return null // resources use integer ids
    if (isDbReady()) {
      const { rows } = await query('SELECT * FROM resources WHERE id = $1', [Number(id)])
      return toResource(rows[0]) || null
    }
    return mockResources.find((r) => r.id === Number(id)) || null
  },

  searchResources: async (queryText = '') => {
    const q = queryText.trim()
    if (isDbReady()) {
      if (!q) {
        const { rows } = await query('SELECT * FROM resources ORDER BY id')
        return rows
      }
      const { rows } = await query(
        `SELECT * FROM resources
         WHERE name ILIKE $1 OR description ILIKE $1 OR category ILIKE $1 OR provider ILIKE $1
         ORDER BY id`,
        [`%${q}%`],
      )
      return rows.map(toResource)
    }
    if (!q) return mockResources
    const lower = q.toLowerCase()
    return mockResources.filter((r) =>
      [r.name, r.description, r.category, r.provider].join(' ').toLowerCase().includes(lower),
    )
  },

  getResourcesByCategory: async (category) => {
    if (isDbReady()) {
      const { rows } = await query('SELECT * FROM resources WHERE category = $1 ORDER BY id', [
        category,
      ])
      return rows.map(toResource)
    }
    return mockResources.filter((r) => r.category === category)
  },

  // Hydrated recommendations: full resource record + matchScore + matchReason.
  // (The frontend renders r.name / r.matchScore / r.matchReason, so hydration
  // is part of the contract and is preserved in both modes.)
  getRecommendedResources: async (situation, topN = 5) => {
    const all = await resourceService.getAllResources()
    const ranked = matchingService.getRecommendedResources(situation, all, topN)
    return ranked
      .map((m) => {
        const resource = all.find((r) => r.id === m.resourceId)
        return resource ? { ...resource, matchScore: m.score, matchReason: m.reason } : null
      })
      .filter(Boolean)
  },

  getResourceWithExplanation: async (resourceId, situation) => {
    const resource = await resourceService.getResourceById(resourceId)
    if (!resource) return null
    const [scored] = matchingService.scoreResources(situation, [resource])
    return { ...resource, matchScore: scored.score, matchReason: scored.reason }
  },

  // --- User saved resources (additive; not yet wired to the frontend) ---
  saveResource: async (userId, resourceId) => {
    if (isDbReady()) {
      await query(
        'INSERT INTO saved_resources (user_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, Number(resourceId)],
      )
      return
    }
    if (!savedByUser.has(userId)) savedByUser.set(userId, new Set())
    savedByUser.get(userId).add(Number(resourceId))
  },

  unsaveResource: async (userId, resourceId) => {
    if (isDbReady()) {
      await query('DELETE FROM saved_resources WHERE user_id = $1 AND resource_id = $2', [
        userId,
        Number(resourceId),
      ])
      return
    }
    savedByUser.get(userId)?.delete(Number(resourceId))
  },

  getUserSavedResources: async (userId) => {
    if (isDbReady()) {
      const { rows } = await query(
        `SELECT r.* FROM resources r
         INNER JOIN saved_resources sr ON r.id = sr.resource_id
         WHERE sr.user_id = $1
         ORDER BY r.id`,
        [userId],
      )
      return rows.map(toResource)
    }
    const ids = savedByUser.get(userId) || new Set()
    return mockResources.filter((r) => ids.has(r.id))
  },
}
