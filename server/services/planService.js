import { groqService } from './groqService.js'
import { matchingService } from './matchingService.js'
import { resourceService } from './resourceService.js'
import { isDbReady, query } from '../database/db.js'

// Plan persistence. Postgres when ready, in-memory otherwise. The public API
// (createPlan, getPlan, updateFromMessage, applyChanges) and the rich plan
// JSON shape returned to the frontend are identical in both modes.

// Whitelist of editable scalar fields -> DB columns (prevents arbitrary
// column names reaching SQL when applying AI-suggested changes).
const FIELD_TO_COLUMN = {
  goal: 'goal',
  riskLevel: 'risk_level',
  urgency: 'urgency',
  summary: 'summary',
  nextBestAction: 'next_best_action',
  estimatedTimeline: 'estimated_timeline',
}

/* -------------------------- in-memory fallback -------------------------- */
const memPlans = new Map()
let memCounter = 0

/* ------------------------------ public API ------------------------------ */
export const planService = {
  // userId scopes the plan to the authenticated user (may be null for an
  // anonymous/unauthenticated request).
  createPlan: async (situation, userId = null) => {
    const plan = await groqService.generatePlan(situation)
    return isDbReady() ? persistNewPlan(situation, plan, userId) : memCreate(situation, plan, userId)
  },

  // Persist a user-confirmed plan draft (no AI generation — the draft is final).
  createFromDraft: async (draft, situation = {}, userId = null) => {
    return isDbReady() ? persistNewPlan(situation, draft, userId) : memCreate(situation, draft, userId)
  },

  // Apply a user-confirmed draft to an existing plan (scoped to the owner).
  // Returns the updated plan, or null if it doesn't exist / isn't owned.
  updateFromDraft: async (planId, draft, situation = {}, userId = null) => {
    return isDbReady()
      ? dbUpdateFromDraft(planId, draft, situation, userId)
      : memUpdateFromDraft(planId, draft)
  },

  getPlan: async (id) => (isDbReady() ? dbGetPlan(id) : memPlans.get(id) || null),

  // List plans for a specific user. Returns [] when no user is provided so a
  // request never sees another user's (or orphaned/null) plans.
  listPlans: async (userId = null) => {
    if (!userId) return []
    if (!isDbReady()) {
      return Array.from(memPlans.values()).filter((p) => p.userId === userId)
    }
    const { rows } = await query(
      `SELECT id, goal, risk_level, urgency, summary, estimated_timeline, next_best_action, created_at, updated_at
       FROM plans WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    )
    return rows.map((p) => ({
      id: p.id,
      goal: p.goal,
      riskLevel: p.risk_level,
      urgency: p.urgency,
      summary: p.summary,
      estimatedTimeline: p.estimated_timeline,
      nextBestAction: p.next_best_action,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))
  },

  updateFromMessage: async (id, userMessage) => {
    const existing = await planService.getPlan(id)
    if (!existing) return { error: 'Plan not found' }

    const update = await groqService.updatePlan(userMessage, existing)

    if (update.planAction === 'update' && Array.isArray(update.changes)) {
      const updated = isDbReady()
        ? await dbApplyChanges(existing, update.changes)
        : memApplyAndStore(existing, update.changes)
      return { planAction: 'update', plan: updated, explanation: update.explanation }
    }
    return { planAction: 'noChange', plan: existing, explanation: update.explanation }
  },

  applyChanges,
}

/* ------------------------------ DB helpers ------------------------------ */
async function persistNewPlan(situation, plan, userId = null) {
  const { rows } = await query(
    `INSERT INTO plans (user_id, name, goal, risk_level, urgency, summary, estimated_timeline, next_best_action, situation)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      userId,
      plan.goal || 'My Plan',
      plan.goal || null,
      plan.riskLevel || null,
      plan.urgency || null,
      plan.summary || null,
      plan.estimatedTimeline || null,
      plan.nextBestAction || null,
      situation ? JSON.stringify(situation) : null,
    ],
  )
  const planId = rows[0].id
  await insertPlanChildren(planId, plan, situation)
  return dbGetPlan(planId)
}

// Insert tasks + scored recommendations for a plan id (shared by create/update).
async function insertPlanChildren(planId, plan, situation) {
  for (const [i, t] of (plan.tasks || []).entries()) {
    await query(
      `INSERT INTO plan_tasks (plan_id, title, description, priority, status, due_date, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [planId, t.title, t.description || null, t.priority || 'Medium', t.completed ? 'completed' : 'pending', t.dueDate || null, i],
    )
  }

  for (const resourceId of plan.recommendedResources || []) {
    // Score against the real resource so match_score reflects its category.
    const resource = await resourceService.getResourceById(resourceId)
    const [scored] = matchingService.scoreResources(situation || {}, [
      resource || { id: resourceId, category: null },
    ])
    const reason =
      plan.whyResources?.[resourceId] ||
      matchingService.getMatchReason(situation || {}, resource || { category: null })
    await query(
      `INSERT INTO plan_recommendations (plan_id, resource_id, match_score, reason)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [planId, Number(resourceId), scored?.score ?? null, reason],
    )
  }
}

// Apply a confirmed draft to an existing plan. Ownership is enforced in the
// UPDATE (user_id must match, unless no user is provided). Children are
// replaced wholesale so tasks/recommendations reflect the new draft.
async function dbUpdateFromDraft(planId, draft, situation, userId) {
  const upd = await query(
    `UPDATE plans
     SET name = $1, goal = $2, risk_level = $3, urgency = $4, summary = $5,
         estimated_timeline = $6, next_best_action = $7, updated_at = NOW()
     WHERE id = $8 AND ($9::uuid IS NULL OR user_id = $9)
     RETURNING id`,
    [
      draft.goal || 'My Plan',
      draft.goal || null,
      draft.riskLevel || null,
      draft.urgency || null,
      draft.summary || null,
      draft.estimatedTimeline || null,
      draft.nextBestAction || null,
      planId,
      userId,
    ],
  )
  if (upd.rows.length === 0) return null // not found or not owned

  await query('DELETE FROM plan_tasks WHERE plan_id = $1', [planId])
  await query('DELETE FROM plan_recommendations WHERE plan_id = $1', [planId])
  await insertPlanChildren(planId, draft, situation)
  return dbGetPlan(planId)
}

async function dbGetPlan(id) {
  // Plan ids are UUIDs only — routes reject non-UUIDs with 404 before this runs,
  // so there is no legacy/mock-id lookup path.
  const { rows: planRows } = await query('SELECT * FROM plans WHERE id = $1', [id])
  if (planRows.length === 0) return null
  const p = planRows[0]

  // Use the resolved UUID (p.id) for child queries — never the raw param.
  const { rows: tasks } = await query(
    'SELECT * FROM plan_tasks WHERE plan_id = $1 ORDER BY sort_order, created_at',
    [p.id],
  )
  const { rows: recs } = await query(
    'SELECT * FROM plan_recommendations WHERE plan_id = $1 ORDER BY match_score DESC NULLS LAST',
    [p.id],
  )

  return reshape(p, tasks, recs)
}

// Map normalized DB rows back into the rich plan JSON the frontend expects.
function reshape(p, tasks, recs) {
  return {
    id: p.id,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    situation: p.situation || null,
    goal: p.goal,
    riskLevel: p.risk_level,
    urgency: p.urgency,
    summary: p.summary,
    estimatedTimeline: p.estimated_timeline,
    nextBestAction: p.next_best_action,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      dueDate: t.due_date,
      completed: t.status === 'completed',
    })),
    recommendedResources: recs.map((r) => r.resource_id),
    whyResources: Object.fromEntries(recs.map((r) => [r.resource_id, r.reason])),
  }
}

async function dbApplyChanges(existing, changes) {
  for (const change of changes) {
    if (change.field === 'tasksRemove') {
      const ids = (change.value || []).map(String)
      if (ids.length) {
        await query('DELETE FROM plan_tasks WHERE plan_id = $1 AND id::text = ANY($2)', [
          existing.id,
          ids,
        ])
      }
    } else if (change.field === 'tasksAdd') {
      for (const t of change.value || []) {
        await query(
          `INSERT INTO plan_tasks (plan_id, title, description, priority, status, due_date)
           VALUES ($1, $2, $3, $4, 'pending', $5)`,
          [existing.id, t.title, t.description || null, t.priority || 'Medium', t.dueDate || null],
        )
      }
    } else if (FIELD_TO_COLUMN[change.field] && 'newValue' in change) {
      const col = FIELD_TO_COLUMN[change.field]
      await query(`UPDATE plans SET ${col} = $1, updated_at = NOW() WHERE id = $2`, [
        change.newValue,
        existing.id,
      ])
    }
  }
  await query('UPDATE plans SET updated_at = NOW() WHERE id = $1', [existing.id])
  return dbGetPlan(existing.id)
}

/* --------------------------- in-memory helpers -------------------------- */
function memCreate(situation, plan, userId = null) {
  const id = `plan-${++memCounter}`
  const stored = { id, userId, createdAt: new Date().toISOString(), situation, ...plan }
  memPlans.set(id, stored)
  return stored
}

function memApplyAndStore(existing, changes) {
  const updated = applyChanges(existing, changes)
  memPlans.set(existing.id, updated)
  return updated
}

function memUpdateFromDraft(planId, draft) {
  const existing = memPlans.get(planId)
  if (!existing) return null
  const updated = {
    ...existing,
    goal: draft.goal ?? existing.goal,
    riskLevel: draft.riskLevel ?? existing.riskLevel,
    urgency: draft.urgency ?? existing.urgency,
    summary: draft.summary ?? existing.summary,
    estimatedTimeline: draft.estimatedTimeline ?? existing.estimatedTimeline,
    nextBestAction: draft.nextBestAction ?? existing.nextBestAction,
    tasks: draft.tasks ?? existing.tasks,
    recommendedResources: draft.recommendedResources ?? existing.recommendedResources,
    updatedAt: new Date().toISOString(),
  }
  memPlans.set(planId, updated)
  return updated
}

// Apply change operations to a plan object, returning a new plan (in-memory).
export function applyChanges(plan, changes = []) {
  const next = { ...plan, tasks: [...(plan.tasks || [])] }
  for (const change of changes) {
    switch (change.field) {
      case 'tasksRemove': {
        const ids = new Set((change.value || []).map(String))
        next.tasks = next.tasks.filter((t) => !ids.has(String(t.id)))
        break
      }
      case 'tasksAdd': {
        const additions = (change.value || []).map((t, i) => ({
          id: t.id ?? nextTaskId(next.tasks) + i,
          completed: false,
          priority: 'Medium',
          ...t,
        }))
        next.tasks = [...next.tasks, ...additions]
        break
      }
      default:
        if (change.field && 'newValue' in change) next[change.field] = change.newValue
    }
  }
  next.updatedAt = new Date().toISOString()
  return next
}

function nextTaskId(tasks) {
  return tasks.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0) + 1
}
