import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, saveProfile } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function OnboardingPage() {
  const [field, setField] = useState('')
  const [role, setRole] = useState('')
  const [school, setSchool] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // If profile already exists, go straight to dashboard
    getProfile().then(p => {
      if (p?.field || p?.target_role) navigate('/dashboard', { replace: true })
    }).catch(() => {})
  }, [navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (field.trim() || role.trim() || school.trim()) {
        await saveProfile(field.trim(), role.trim(), school.trim())
      }
    } catch {}
    navigate('/dashboard')
  }

  function handleSkip() {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-primary/20">
            <span className="text-2xl">🎓</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome!</h1>
          <p className="text-muted-foreground mt-1">
            Let's personalise your coaching so every session is relevant to you.
          </p>
        </div>

        <Card className="shadow-xl border-0 shadow-slate-200/80">
          <CardHeader>
            <CardTitle>Three quick questions</CardTitle>
            <CardDescription>
              The AI uses these to tailor every question, example, and scenario to your actual world.
              No dropdowns — type anything.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">What are you studying?</label>
                <Input
                  value={field}
                  onChange={e => setField(e.target.value)}
                  placeholder="e.g. Computer Science, Nursing, Criminal Justice, Marine Biology..."
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">What kind of role are you working toward?</label>
                <Input
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Software internship, Clinical rotation, Policy research..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">What school do you go to?</label>
                <Input
                  value={school}
                  onChange={e => setSchool(e.target.value)}
                  placeholder="e.g. Santa Clara University, University of Denver, UCLA..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" size="lg" className="flex-1" disabled={loading}>
                  {loading ? 'Saving...' : "Let's go →"}
                </Button>
                <Button type="button" variant="ghost" size="lg" onClick={handleSkip}>
                  Skip
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
