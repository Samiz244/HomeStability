import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { resourcesApi } from './api/resourcesApi.js'

const SavedContext = createContext(null)

export function SavedProvider({ children }) {
  const [savedIds, setSavedIds] = useState(() => new Set())

  // Load the signed-in user's saved resources from the API (scoped to the
  // session by the backend). Returns [] when not signed in.
  useEffect(() => {
    let active = true
    resourcesApi
      .listSaved()
      .then((list) => {
        if (active && Array.isArray(list)) setSavedIds(new Set(list.map((r) => Number(r.id))))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const toggleSaved = (id) => {
    const numId = Number(id)
    const willSave = !savedIds.has(numId)
    // Optimistic local update so the UI stays instant and unchanged.
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (willSave) next.add(numId)
      else next.delete(numId)
      return next
    })
    // Persist (best-effort — stays local for the session if not signed in).
    const op = willSave ? resourcesApi.save(numId) : resourcesApi.unsave(numId)
    op?.catch(() => {})
  }

  const value = useMemo(
    () => ({
      savedIds,
      isSaved: (id) => savedIds.has(Number(id)),
      toggleSaved,
      savedCount: savedIds.size,
    }),
    [savedIds],
  )

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
}

export function useSaved() {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSaved must be used within a SavedProvider')
  return ctx
}
