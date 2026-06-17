import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'

export default function PlaceholderPage({ title, subtitle }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white py-20 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage-light text-sage">
          <Construction size={22} />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-700">This section is coming soon</p>
        <p className="mt-1 text-sm text-gray-500">
          We&apos;re still building this page. In the meantime, explore the resource directory.
        </p>
        <Link
          to="/resources"
          className="mt-5 inline-flex rounded-lg bg-sage px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-dark"
        >
          Go to Resource Directory
        </Link>
      </div>
    </div>
  )
}
