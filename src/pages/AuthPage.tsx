import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register, getProfile } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function AuthPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = tab === 'login' ? login : register
      const data = await fn(username.trim(), password)

      // On signup: clear all old chat history (brand new user)
      // On login: only clear chat history belonging to OTHER users
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('chat_history_')) {
          const belongsToThisUser = k.startsWith(`chat_history_${data.username}_`)
          if (tab === 'signup' || !belongsToThisUser) localStorage.removeItem(k)
        }
      })

      localStorage.setItem('token', data.token)
      localStorage.setItem('username', data.username)

      // Check if profile already exists — skip onboarding if so
      const profile = await getProfile()
      if (profile?.field || profile?.target_role || profile?.school) {
        navigate('/dashboard')
      } else {
        navigate('/onboarding')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / brand */}
        <div className="text-center mb-8">
          <img src="/Highview Logo - Dark.png" alt="HighView" className="h-10 w-auto mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-foreground tracking-tight mt-3">SEP AI Coach</h1>
          <p className="text-muted-foreground mt-1">Your personal early-career coach</p>
        </div>

        <Card className="shadow-xl border-0 shadow-slate-200/80">
          <CardHeader className="pb-4">
            {/* Tabs */}
            <div className="flex rounded-lg bg-muted p-1 gap-1">
              {(['login', 'signup'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError('') }}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                    tab === t
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>
            <CardTitle className="mt-4 text-xl">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </CardTitle>
            <CardDescription>
              {tab === 'login' ? 'Sign in to continue your coaching sessions' : 'Start your coaching journey today'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Please wait...' : tab === 'login' ? 'Log In' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
