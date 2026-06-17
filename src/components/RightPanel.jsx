import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { HELPFUL_LINKS } from '../data/resources.js'
import { useSaved } from '../SavedContext.jsx'

const STEPS = [
  { label: 'Share your situation', done: true },
  { label: 'Review your options', done: false },
  { label: 'Get your plan', done: false },
  { label: 'Get resources & reminders', done: false },
]

export default function RightPanel() {
  const { savedCount } = useSaved()

  return (
    <div className="flex flex-col gap-5">
      {/* Progress card */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-bold text-gray-900">Your Progress</h3>
        <ol className="mt-4 space-y-0">
          {STEPS.map((step, i) => (
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
                {i < STEPS.length - 1 && (
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

        <div className="mt-4">
          <div className="text-xs text-gray-500">Current Goal</div>
          <div className="mt-0.5 text-sm font-semibold text-gray-900">
            Avoid Eviction &amp; Keep Housing
          </div>
        </div>

        <dl className="mt-4 space-y-2.5 text-sm">
          <Row label="Risk Level" value={<span className="font-semibold text-rose-600">High</span>} />
          <Row label="Plan Completion" value="25%" />
          <Row label="Tasks Completed" value="2 of 8" />
          <Row label="Resources Saved" value={String(savedCount || 6)} />
        </dl>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-sage" style={{ width: '25%' }} />
        </div>
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
                to="/resources"
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
