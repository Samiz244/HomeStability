import { NavLink, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  ClipboardList,
  LayoutGrid,
  LogOut,
  MessageSquarePlus,
  Phone,
  Settings,
  User,
} from 'lucide-react'
import { useSaved } from '../SavedContext.jsx'
import { useAuth } from '../AuthContext.jsx'

const NAV_ITEMS = [
  { to: '/chat', label: 'New Conversation', icon: MessageSquarePlus },
  { to: '/resources', label: 'Resource Directory', icon: LayoutGrid },
  { to: '/plan', label: 'My Plan', icon: ClipboardList },
  { to: '/saved', label: 'Saved Resources', icon: Bookmark, showCount: true },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ onNavigate }) {
  const { savedCount } = useSaved()
  const { user, isAuthed, signOut } = useAuth()
  const navigate = useNavigate()

  const handleAuthAction = async () => {
    onNavigate?.()
    if (isAuthed) {
      await signOut()
      navigate('/resources')
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="flex h-full w-full flex-col px-4 py-5">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-light text-sage">
          <HouseMark />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold text-gray-900">Housing Stability Guide</div>
          <div className="text-xs text-gray-500">Atlanta</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-7 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, showCount }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sage-light text-sage'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={isActive ? 'text-sage' : 'text-gray-400 group-hover:text-gray-600'}
                />
                <span className="flex-1">{label}</span>
                {showCount && savedCount > 0 && (
                  <span className="rounded-full bg-sage px-2 py-0.5 text-[11px] font-semibold text-white">
                    {savedCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Crisis card */}
      <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-rose-800">
          <Phone size={15} className="text-rose-600" />
          Need help right away?
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-rose-700/90">
          If you are in immediate danger or need emergency shelter, please call 911.
        </p>
        <button className="mt-3 w-full rounded-lg bg-sage px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-sage-dark">
          View Crisis Resources
        </button>
      </div>

      {/* User card */}
      <button
        onClick={handleAuthAction}
        className="group mt-4 flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          <User size={18} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold text-gray-900">
            {user?.name || 'Guest User'}
          </div>
          <div className="truncate text-xs text-gray-500">
            {isAuthed ? 'Sign out' : 'Sign in to save your plan and history'}
          </div>
        </div>
        {isAuthed && (
          <LogOut size={16} className="shrink-0 text-gray-400 group-hover:text-gray-600" />
        )}
      </button>
    </div>
  )
}

function HouseMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9 21v-6h6v6" />
    </svg>
  )
}
