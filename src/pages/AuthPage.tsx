import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, register } from '../lib/api'

export default function AuthPage() {
  const [tab, setTab]           = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = tab === 'login'
        ? await login(username.trim(), password)
        : await register(username.trim(), password, email.trim())

      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('chat_history_')) {
          const mine = k.startsWith(`chat_history_${data.username}_`)
          if (tab === 'signup' || !mine) localStorage.removeItem(k)
        }
      })

      localStorage.setItem('token',    data.token)
      localStorage.setItem('username', data.username)

      navigate('/dashboard')
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

        {/* Brand */}
        <div className="text-center mb-8">
          <img src="/highview-logo.png" alt="HighView" className="h-10 w-auto mx-auto" />
          <h1 className="text-2xl font-extrabold text-slate-800 mt-4 tracking-tight">AI Coach</h1>
          <p className="text-slate-500 mt-1 font-medium">Your personal early-career coach</p>
        </div>

        {/* Card */}
        <div className="auth-card px-8 py-8">

          {/* Tab switcher */}
          <div className="flex rounded-2xl bg-slate-100 p-1 gap-1 mb-7">
            {(['login', 'signup'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  tab === t
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {tab === 'login'
                ? 'Sign in to continue your coaching sessions'
                : 'Start your coaching journey today'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                className={inputClass}
              />
            </div>

            {/* Email — only on signup */}
            {tab === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className={inputClass}
                />
                <p className="text-xs text-slate-400">Used for password recovery only</p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
                {tab === 'login' && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
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
              {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          HighView · AI Coach © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
