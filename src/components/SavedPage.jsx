import { Link } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { useSaved } from '../SavedContext.jsx'
import { useResources } from '../ResourcesContext.jsx'
import ResourceCard from './ResourceCard.jsx'

export default function SavedPage() {
  const { savedIds } = useSaved()
  const { resources } = useResources()
  const saved = resources.filter((r) => savedIds.has(r.id))

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Saved Resources</h1>
      <p className="mt-1 text-sm text-gray-500">
        Resources you&apos;ve saved for quick access later.
      </p>

      {saved.length > 0 ? (
        <>
          <p className="mt-5 text-sm text-gray-500">
            {saved.length} {saved.length === 1 ? 'resource' : 'resources'} saved
          </p>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage-light text-sage">
            <Bookmark size={22} />
          </div>
          <p className="mt-4 text-sm font-medium text-gray-700">No saved resources yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Browse the directory and tap{' '}
            <span className="font-semibold text-sage">Save</span> to keep resources here.
          </p>
          <Link
            to="/resources"
            className="mt-5 inline-flex rounded-lg bg-sage px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-dark"
          >
            Browse Resources
          </Link>
        </div>
      )}
    </div>
  )
}
