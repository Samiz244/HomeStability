import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { resourcesApi } from './api/resourcesApi.js'

const ResourcesContext = createContext(null)

// Loads the resource directory from the API (GET /api/resources) once and
// shares it across the app. If the API is unreachable it falls back to the
// local dataset (dev/offline only) so the UI still renders.
export function ResourcesProvider({ children }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        // The API is the single source of truth for resource records. The
        // backend itself serves a memory fallback when no DB is configured, so
        // the frontend never imports resource data directly.
        const data = await resourcesApi.list()
        if (active) setResources(data)
      } catch (err) {
        if (active) setError(err)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const byId = useMemo(() => {
    const m = new Map()
    for (const r of resources) m.set(String(r.id), r)
    return m
  }, [resources])

  const value = useMemo(
    () => ({
      resources,
      loading,
      error,
      getById: (id) => byId.get(String(id)) || null,
    }),
    [resources, loading, error, byId],
  )

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>
}

export function useResources() {
  const ctx = useContext(ResourcesContext)
  if (!ctx) throw new Error('useResources must be used within a ResourcesProvider')
  return ctx
}
