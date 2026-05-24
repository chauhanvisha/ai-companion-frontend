import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessionNotes, SessionNote } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { LogOut, ArrowRight, Clock } from 'lucide-react'

const SCENARIOS = [
  { key: 'interview', icon: '🎯', title: 'Interview Prep',       description: 'Practice mock questions and get real-time feedback',     gradient: 'from-blue-500 to-blue-600' },
  { key: 'inbox',     icon: '📥', title: 'Inbox Reset',          description: 'Build a system to tame your overloaded inbox',            gradient: 'from-purple-500 to-purple-600' },
  { key: 'email',     icon: '✉️',  title: 'Email Writing',        description: 'Draft professional emails that make the right impression', gradient: 'from-emerald-500 to-emerald-600' },
]

const SCENARIO_TITLES: Record<string, string> = Object.fromEntries(SCENARIOS.map(s => [s.key, s.title]))
const SCENARIO_ICONS: Record<string, string> = Object.fromEntries(SCENARIOS.map(s => [s.key, s.icon]))

export default function DashboardPage() {
  const username = localStorage.getItem('username') || 'there'
  const [notes, setNotes] = useState<SessionNote[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    getSessionNotes().then(setNotes).catch(() => {})
  }, [])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    navigate('/')
  }

  function startScenario(key: string) {
    navigate(`/chat/${key}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm">
              🎓
            </div>
            <span className="font-semibold text-foreground">SEP AI Coach</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">Hi, {username}!</span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Hi, {username}! 👋
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">What would you like to work on today?</p>
        </div>

        {/* Scenario tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
          {SCENARIOS.map(s => (
            <Card
              key={s.key}
              className="group hover:shadow-xl transition-all duration-300 cursor-pointer border hover:border-primary/20"
              onClick={() => startScenario(s.key)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-xl shadow-sm mb-3`}>
                    {s.icon}
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
                </div>
                <CardTitle className="text-lg">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                  Start session →
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent sessions */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Your recent sessions
          </h2>
          {notes.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground text-sm">
                  Complete your first session to start building your coaching history.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {notes.map((note, i) => {
                const firstBullet = note.notes.split('\n')[0].replace(/^[•\-*]\s*/, '').trim()
                const date = new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                return (
                  <Card key={i} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => startScenario(note.scenario)}>
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{SCENARIO_ICONS[note.scenario] || '💬'}</span>
                        <span className="text-sm font-medium">{SCENARIO_TITLES[note.scenario] || note.scenario}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{date}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{firstBullet}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
