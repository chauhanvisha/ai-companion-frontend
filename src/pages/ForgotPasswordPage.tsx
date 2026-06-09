import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../lib/api'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <img src="/highview-logo.png" alt="HighView" className="h-10 w-auto mx-auto" />
          <h1 className="text-2xl font-extrabold text-slate-800 mt-4 tracking-tight">AI Coach</h1>
        </div>

        <div className="auth-card px-8 py-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-3xl">
                📬
              </div>
              <h2 className="text-xl font-bold text-slate-800">Check your email</h2>
              <p className="text-sm text-slate-500">
                If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your inbox.
              </p>
              <Link
                to="/"
                className="inline-block mt-4 text-sm text-primary font-semibold hover:underline"
              >
                Back to Log In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Forgot your password?</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm
                      text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
                      focus:ring-primary/30 focus:border-primary/50 transition-all"
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
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>

              <Link
                to="/"
                className="flex items-center justify-center gap-1.5 mt-5 text-sm text-slate-400 hover:text-slate-600 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Log In
              </Link>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          HighView · AI Coach © 2025
        </p>
      </div>
    </div>
  )
}
