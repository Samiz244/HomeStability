import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  CheckCircle2,
  Clock,
  ExternalLink,
  HandCoins,
  Home,
  Loader2,
  Phone,
  Scale,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react'
import { CATEGORIES } from '../data/resources.js' // presentation config only
import { useSaved } from '../SavedContext.jsx'
import { useResources } from '../ResourcesContext.jsx'
import { resourcesApi } from '../api/resourcesApi.js'

const ICONS = { HandCoins, Scale, Home, Zap }

const SUGGESTED_QUESTIONS = [
  'Do I qualify for this program?',
  'What documents do I need?',
  'How long does it take to get approved?',
]

export default function ResourceDetail() {
  const { id } = useParams()
  const { isSaved, toggleSaved } = useSaved()
  const { getById } = useResources()
  const [resource, setResource] = useState(() => getById(id))
  const [loading, setLoading] = useState(!resource)

  // Fetch the resource from the API (GET /api/resources/:id). Seed from the
  // shared cache for instant render, then refresh from the endpoint.
  useEffect(() => {
    let active = true
    const cached = getById(id)
    setResource(cached)
    setLoading(!cached)
    resourcesApi
      .get(id)
      .then((r) => active && r && setResource(r))
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, getById])

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-2 py-20 text-sm text-gray-500">
        <Loader2 size={16} className="animate-spin" /> Loading resource…
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/resources" className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage hover:underline">
          <ArrowLeft size={16} /> Back to Resources
        </Link>
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-card">
          <p className="text-sm font-medium text-gray-700">Resource not found</p>
        </div>
      </div>
    )
  }

  const cat = CATEGORIES[resource.category]
  const Icon = ICONS[cat?.icon] ?? Home
  const saved = isSaved(resource.id)

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/resources"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage hover:underline"
      >
        <ArrowLeft size={16} /> Back to Resources
      </Link>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${cat?.iconBg}`}>
                <Icon size={26} className={cat?.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cat?.badgeClass}`}
                  >
                    {resource.category}
                  </span>
                  {resource.verified && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-sage">
                      <BadgeCheck size={15} /> Verified
                    </span>
                  )}
                </div>
                <h1 className="mt-2 text-xl font-bold text-gray-900">{resource.name}</h1>
                <p className="mt-0.5 text-sm text-gray-500">{resource.provider}</p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-relaxed text-gray-600">{resource.description}</p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {resource.website && (
                <a
                  href={resource.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-sage px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-dark"
                >
                  Visit Official Website
                  <ExternalLink size={15} />
                </a>
              )}
              <button
                onClick={() => toggleSaved(resource.id)}
                className={[
                  'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors',
                  saved
                    ? 'border-sage bg-sage-light text-sage'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>

          {/* Eligibility */}
          {resource.eligibility && (
            <Section title="Who It's For">
              <ul className="space-y-2">
                {resource.eligibility.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-sage" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* How to apply */}
          {resource.howToApply && (
            <Section title="How to Apply">
              <ol className="space-y-3">
                {resource.howToApply.map((step, i) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-light text-xs font-bold text-sage">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* Contact */}
          {resource.contact && (
            <Section title="Contact & Hours">
              <div className="space-y-2.5 text-sm text-gray-600">
                <div className="flex items-center gap-2.5">
                  <Phone size={16} className="text-sage" />
                  {resource.contact.phone}
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock size={16} className="text-sage" />
                  {resource.contact.hours}
                </div>
              </div>
            </Section>
          )}
        </div>

        {/* Ask AI panel */}
        <aside className="space-y-4">
          <AskResourcePanel resource={resource} />
        </aside>
      </div>
    </div>
  )
}

function AskResourcePanel({ resource }) {
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState([]) // { role: 'user' | 'ai', text }
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  // Auto-grow the question textarea up to ~5 lines, then scroll within it.
  // Runs whenever `question` changes — including the reset to '' after asking.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [question])

  const ask = async (q) => {
    const text = (q ?? question).trim()
    if (!text || loading) return
    setThread((t) => [...t, { role: 'user', text }])
    setQuestion('')
    setLoading(true)
    try {
      const { answer } = await resourcesApi.ask(resource.id, text)
      setThread((t) => [...t, { role: 'ai', text: answer }])
    } catch {
      setThread((t) => [
        ...t,
        { role: 'ai', text: 'Sorry, I had trouble answering just now. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-light text-sage">
          <Sparkles size={16} />
        </div>
        <h3 className="text-sm font-bold text-gray-900">Ask AI About This Resource</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        Get answers about this program to help you decide if it&apos;s right for you.
      </p>

      {/* Conversation thread */}
      {thread.length > 0 && (
        <div className="mt-4 space-y-3">
          {thread.map((m, i) => (
            <div
              key={i}
              className={[
                'rounded-lg px-3 py-2 text-xs leading-relaxed',
                m.role === 'user'
                  ? 'ml-6 bg-sage text-white'
                  : 'mr-2 bg-gray-50 text-gray-700',
              ].join(' ')}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="mr-2 inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <Loader2 size={13} className="animate-spin" /> Thinking…
            </div>
          )}
        </div>
      )}

      {/* Suggested questions */}
      {thread.length === 0 && (
        <div className="mt-4 space-y-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={loading}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-700 transition-colors hover:border-sage/40 hover:bg-sage-light/60 disabled:opacity-60"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask()
        }}
        className="mt-4 flex items-end gap-2 rounded-lg border border-gray-300 px-3 py-2"
      >
        <textarea
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter inserts a new line.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask()
            }
          }}
          rows={1}
          placeholder="Type your question..."
          className="min-w-0 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-5 text-gray-700 placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-md bg-sage p-1.5 text-white transition-colors hover:bg-sage-dark disabled:opacity-50"
          aria-label="Send question"
        >
          <Send size={14} />
        </button>
      </form>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
        Information is provided by the program and may change. Always check the official website
        for the latest details.
      </p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  )
}
