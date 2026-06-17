import express from 'express'
import { resourceService } from '../services/resourceService.js'
import { groqService } from '../services/groqService.js'

const router = express.Router()

router.get('/', async (_req, res) => {
  res.json(await resourceService.getAllResources())
})

// Saved resources for the authenticated user. Declared before "/:id" so
// "saved" isn't captured as a resource id. Returns [] when not signed in.
router.get('/saved', async (req, res) => {
  if (!req.user?.id) return res.json([])
  res.json(await resourceService.getUserSavedResources(req.user.id))
})

router.post('/:id/save', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Sign in to save resources' })
  await resourceService.saveResource(req.user.id, req.params.id)
  res.json({ ok: true })
})

router.delete('/:id/save', async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: 'Sign in to save resources' })
  await resourceService.unsaveResource(req.user.id, req.params.id)
  res.json({ ok: true })
})

// Recommend resources for a situation. Declared before "/:id" so it isn't
// captured as an id.
router.post('/recommend', async (req, res) => {
  const { situation } = req.body || {}
  const recommended = await resourceService.getRecommendedResources(situation || {})
  res.json(recommended)
})

router.post('/search', async (req, res) => {
  const results = await resourceService.searchResources(req.body?.query || '')
  res.json(results)
})

router.get('/category/:category', async (req, res) => {
  res.json(await resourceService.getResourcesByCategory(req.params.category))
})

router.get('/:id', async (req, res) => {
  const resource = await resourceService.getResourceById(req.params.id)
  if (!resource) return res.status(404).json({ error: 'Not found' })
  res.json(resource)
})

// Ask the AI a question about a specific resource.
router.post('/:id/ask', async (req, res) => {
  const resource = await resourceService.getResourceById(req.params.id)
  if (!resource) return res.status(404).json({ error: 'Not found' })
  const answer = await groqService.askAboutResource(
    resource.name,
    resource,
    req.body?.question || '',
  )
  res.json({ answer })
})

export default router
