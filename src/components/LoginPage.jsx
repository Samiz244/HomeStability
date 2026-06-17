import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { Loader2, ShieldCheck } from 'lucide-react'
import { useAuth } from '../AuthContext.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signInWithGoogle, signInAsGuest } = useAuth()
  const [loading, setLoading] = useState(null) // 'google' | 'guest' | null
  const [error, setError] = useState('')

  // Receives the Google ID token (a signed JWT) and sends it to the backend
  // for verification.
  const handleGoogleCredential = async (credentialResponse) => {
    const idToken = credentialResponse?.credential
    if (!idToken) return
    setLoading('google')
    setError('')
    try {
      await signInWithGoogle(idToken)
      navigate('/resources')
    } catch {
      setError('Google sign-in failed. Please try again.')
      setLoading(null)
    }
  }

  const handleGuest = async () => {
    setLoading('guest')
    try {
      await signInAsGuest()
      navigate('/resources')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafaf8] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-light text-sage">
            <HouseMark />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-bold text-gray-900">Housing Stability Guide</h1>
            <p className="text-xs text-gray-500">Atlanta</p>
          </div>
        </div>

        <h2 className="mt-7 text-xl font-bold text-gray-900">Create an account or sign in</h2>
        <p className="mt-1 text-sm text-gray-500">
          Use your Google account to get started, or continue as a guest.
        </p>

        {/* Custom-styled Google button (unchanged visual) with a transparent
            real GoogleLogin overlaid on top to capture the click and return a
            verifiable ID token. */}
        <div className="relative mt-6">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {loading === 'google' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <GoogleMark />
            )}
            Continue with Google
          </button>
          {loading === null && (
            <div className="absolute inset-0 overflow-hidden opacity-0" aria-label="Sign in with Google">
              <GoogleLogin
                onSuccess={handleGoogleCredential}
                onError={() => setError('Google sign-in failed. Please try again.')}
                width="384"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleGuest}
          disabled={loading !== null}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-sage py-3 text-sm font-semibold text-white transition-colors hover:bg-sage-dark disabled:opacity-60"
        >
          {loading === 'guest' && <Loader2 size={18} className="animate-spin" />}
          Continue as Guest
        </button>

        {error && <p className="mt-3 text-center text-xs text-rose-600">{error}</p>}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <ShieldCheck size={14} className="text-sage" />
          Your information is secure and private.
        </div>
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
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
