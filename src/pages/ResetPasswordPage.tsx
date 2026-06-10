import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../lib/api'

export default function ResetPasswordPage() {
  const [searchParams]        = useSearchParams()
  const token                 = searchParams.get('token') || ''
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [done, setDone]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const navigate                  = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/'), 2500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm
    text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
    focus:ring-primary/30 focus:border-primary/50 transition-all`

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <img src="/highview-logo.png" alt="HighView" className="h-10 w-auto mx-auto" />
          <h1 className="text-2xl font-extrabold text-slate-800 mt-4 tracking-tight">AI Coach</h1>
        </div>

        <div className="auth-card px-8 py-8">
          {!token ? (
            <div className="text-center space-y-3">
              <div className="text-3xl">⚠️</div>
              <h2 className="text-xl font-bold text-slate-800">Invalid reset link</h2>
              <p className="text-sm text-slate-500">This link is missing or invalid. Please request a new one.</p>
              <Link to="/forgot-password" className="inline-block mt-2 text-sm text-primary font-semibold hover:underline">
                Request new link
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-3xl">
                ✅
              </div>
              <h2 className="text-xl font-bold text-slate-800">Password reset!</h2>
              <p className="text-sm text-slate-500">Your password has been updated. Redirecting to login…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Set new password</h2>
                <p className="text-sm text-slate-500 mt-1">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    autoFocus
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className={inputClass}
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 font-medium">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-primary text-white text-sm font-bold
                    hover:bg-primary/90 transition-all disabled:opacity-60
                    shadow-lg shadow-primary/25 mt-2"
                >
                  {loading ? 'Saving…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          HighView · AI Coach © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
