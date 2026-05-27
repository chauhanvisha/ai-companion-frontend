import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessionNotes, getProfile, saveProfile, SessionNote } from '../lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { LogOut, ArrowRight, Clock, Pencil } from 'lucide-react'

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

  // Profile state
  const [profileField, setProfileField] = useState('')
  const [profileTargetRole, setProfileTargetRole] = useState('')
  const [profileSchool, setProfileSchool] = useState('')
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  useEffect(() => {
    getSessionNotes().then(setNotes).catch(() => {})
    getProfile().then((p) => {
      if (p) {
        setProfileField(p.field || '')
        setProfileTargetRole(p.target_role || '')
        setProfileSchool(p.school || '')
      }
      setProfileLoaded(true)
    }).catch(() => setProfileLoaded(true))
  }, [])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    navigate('/')
  }

  function startScenario(key: string) {
    navigate(`/chat/${key}`)
  }

  async function handleSaveProfile() {
    setProfileSaving(true)
    try {
      await saveProfile(profileField, profileTargetRole, profileSchool)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch {
      // silently ignore
    } finally {
      setProfileSaving(false)
    }
  }

  const profileIsEmpty = profileLoaded && !profileField && !profileTargetRole && !profileSchool

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/highview-logo.png" alt="HighView" className="h-7 w-auto" />
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

        {/* Your Profile card */}
        <div className="mb-12">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Pencil className="w-4 h-4 text-muted-foreground" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Keep this up to date so coaching stays relevant to you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profileIsEmpty ? (
                <p className="text-sm text-muted-foreground mb-4">
                  Add your details to personalise coaching →
                </p>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground font-medium">Studying</label>
                  <input
                    type="text"
                    value={profileField}
                    onChange={e => setProfileField(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                      placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground font-medium">Goal</label>
                  <input
                    type="text"
                    value={profileTargetRole}
                    onChange={e => setProfileTargetRole(e.target.value)}
                    placeholder="e.g. Product Manager"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                      placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground font-medium">School</label>
                  <input
                    type="text"
                    value={profileSchool}
                    onChange={e => setProfileSchool(e.target.value)}
                    placeholder="e.g. Stanford"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                      placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <Button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                size="sm"
                variant={profileSaved ? 'outline' : 'default'}
              >
                {profileSaved ? 'Saved ✓' : 'Save changes'}
              </Button>
            </CardContent>
          </Card>
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
