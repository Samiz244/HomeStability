import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { HELPFUL_LINKS } from '../data/resources.js'
import { useSaved } from '../SavedContext.jsx'
import { conversationsApi } from '../api/conversationsApi.js'
import { plansApi } from '../api/plansApi.js'

// Maps each "Helpful Resources" label to the category it filters the directory by.
const HELPFUL_LINK_CATEGORIES = {
  'Rental Assistance Programs': 'Rent & Financial Help',
  'Legal Aid Services': 'Legal Aid',
  'Shelters Near You': 'Shelter & Housing',
  'Affordable Housing Search': 'Shelter & Housing',
  'Food & Utility Support': 'Utilities',
}

function helpfulLinkTo(label) {
  const category = HELPFUL_LINK_CATEGORIES[label]
  return category ? `/resources?${new URLSearchParams({ category })}` : '/resources'
}

export default function RightPanel() {
  const { savedCount } = useSaved()
  const [hasConversation, setHasConversation] = useState(false)
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(true)

  // Derive progress + Plan Overview from real data. Plan uses the same pattern as
  // PlanPage: list, then fetch the first/active plan's full detail.
  useEffect(() => {
    let active = true

    const loadPlan = async () => {
      try {
        const list = await plansApi.list().catch(() => [])
        const id = Array.isArray(list) && list.length > 0 ? list[0].id : null
        const full = id ? await plansApi.get(id).catch(() => null) : null
        if (active) setPlan(full)
      } finally {
        if (active) setPlanLoading(false)
      }
    }

    conversationsApi
      .list()
      .then((list) => active && Array.isArray(list) && setHasConversation(list.length > 0))
      .catch(() => {})
    loadPlan()

    // Re-fetch when plan data changes elsewhere (e.g. checking a task on /plan).
    const onPlanChanged = () => loadPlan()
    window.addEventListener('hsg:plan-changed', onPlanChanged)
    return () => {
      active = false
      window.removeEventListener('hsg:plan-changed', onPlanChanged)
    }
  }, [])

  const hasPlan = Boolean(plan)
  const tasks = plan?.tasks || []
  const completedCount = tasks.filter((t) => t.completed).length
  const completion = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  const steps = [
    { label: 'Share your situation', done: hasConversation },
    { label: 'Review your options', done: hasPlan },
    { label: 'Get your plan', done: hasPlan },
    { label: 'Get resources & reminders', done: savedCount > 0 },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Progress card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-bold text-gray-900">Your Progress</h3>
        <ol className="mt-4 space-y-0">
          {steps.map((step, i) => (
            <li key={step.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                    step.done
                      ? 'border-sage bg-sage text-white'
                      : 'border-gray-300 bg-white text-gray-400',
                  ].join(' ')}
                >
                  {step.done ? <Check size={13} strokeWidth={3} /> : i + 1}
                </span>
                {i < steps.length - 1 && (
                  <span
                    className={[
                      'my-1 w-px flex-1',
                      step.done ? 'bg-sage/40' : 'bg-gray-200',
                    ].join(' ')}
                  />
                )}
              </div>
              <span
                className={[
                  'pb-5 text-sm',
                  step.done ? 'font-medium text-gray-900' : 'text-gray-500',
                ].join(' ')}
              >
                {step.label}
                {step.done && (
                  <span className="mt-0.5 block text-xs font-medium text-sage">Completed</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Plan overview card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Plan Overview</h3>
          <Link to="/plan" className="text-xs font-semibold text-sage hover:underline">
            Edit Plan
          </Link>
        </div>

        {planLoading ? (
          <div className="mt-4">
            <div className="text-xs text-gray-400">Current Goal</div>
            <div className="mt-0.5 text-sm font-semibold text-gray-300">Loading…</div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <Row label="Risk Level" value={<span className="text-gray-300">—</span>} />
              <Row label="Plan Completion" value={<span className="text-gray-300">—</span>} />
              <Row label="Tasks Completed" value={<span className="text-gray-300">—</span>} />
              <Row label="Resources Saved" value={<span className="text-gray-300">—</span>} />
            </dl>
          </div>
        ) : !hasPlan ? (
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-900">No plan yet</div>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              Start a conversation and we&apos;ll create a personalized plan for you.
            </p>
            <Link
              to="/chat"
              className="mt-2 inline-block text-xs font-semibold text-sage hover:underline"
            >
              Go to Chat →
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="text-xs text-gray-500">Current Goal</div>
              <div className="mt-0.5 text-sm font-semibold text-gray-900">{plan.goal}</div>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <Row
                label="Risk Level"
                value={
                  <span
                    className={[
                      'font-semibold',
                      plan.riskLevel === 'High' ? 'text-rose-600' : 'text-gray-900',
                    ].join(' ')}
                  >
                    {plan.riskLevel || '—'}
                  </span>
                }
              />
              <Row label="Plan Completion" value={`${completion}%`} />
              <Row label="Tasks Completed" value={`${completedCount} of ${tasks.length}`} />
              <Row label="Resources Saved" value={String(savedCount)} />
            </dl>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-sage transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </>
        )}
      </section>

      {/* Helpful resources card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Helpful Resources</h3>
          <Link to="/resources" className="text-xs font-semibold text-sage hover:underline">
            View All
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-gray-100">
          {HELPFUL_LINKS.map((label) => (
            <li key={label}>
              <Link
                to={helpfulLinkTo(label)}
                className="flex items-center justify-between py-2.5 text-sm text-gray-700 hover:text-sage"
              >
                {label}
                <ChevronRight size={16} className="text-gray-400" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}
