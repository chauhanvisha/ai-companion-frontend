import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSessionNotes, getProfile, saveProfile, SessionNote } from '../lib/api'
import { LogOut, ArrowRight, Clock, Pencil, Mic, Inbox, Mail, CheckCircle, Flame, Trophy } from 'lucide-react'

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  interview: <Mic  className="w-6 h-6 text-white" />,
  inbox:     <Inbox className="w-6 h-6 text-white" />,
  email:     <Mail  className="w-6 h-6 text-white" />,
}
const SCENARIO_EMOJI: Record<string, string> = {
  interview: '🎯', inbox: '📥', email: '✉️',
}

const SCENARIOS = [
  {
    key: 'interview',
    title: 'Interview Prep',
    description: 'Practice mock questions and get real-time coaching feedback',
    iconClass: 'icon-box-blue',
  },
  {
    key: 'inbox',
    title: 'Inbox Reset',
    description: 'Build a system to tame your overloaded inbox effectively',
    iconClass: 'icon-box-violet',
  },
  {
    key: 'email',
    title: 'Email Writing',
    description: 'Draft professional emails that make the right impression',
    iconClass: 'icon-box-green',
  },
]

const SCENARIO_TITLES: Record<string, string> = Object.fromEntries(SCENARIOS.map(s => [s.key, s.title]))

export default function DashboardPage() {
  const username = localStorage.getItem('username') || 'there'
  const [notes, setNotes] = useState<SessionNote[]>([])
  const navigate = useNavigate()

  const [profileField, setProfileField]           = useState('')
  const [profileTargetRole, setProfileTargetRole] = useState('')
  const [profileSchool, setProfileSchool]         = useState('')
  const [profileLoaded, setProfileLoaded]         = useState(false)
  const [profileSaved, setProfileSaved]           = useState(false)
  const [profileSaving, setProfileSaving]         = useState(false)

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

  async function handleSaveProfile() {
    setProfileSaving(true)
    try {
      await saveProfile(profileField, profileTargetRole, profileSchool)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch {
      // ignore
    } finally {
      setProfileSaving(false)
    }
  }

  const profileIsEmpty = profileLoaded && !profileField && !profileTargetRole && !profileSchool

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-blue-100/80"
           style={{ boxShadow: '0 2px 16px rgba(28,136,252,0.07)' }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/highview-logo.png" alt="HighView" className="h-7 w-auto" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block font-medium">
              Hi, {username}!
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-500
                hover:text-slate-700 hover:bg-slate-100 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">
            Hi, {username}! 👋
          </h1>
          <p className="text-slate-500 mt-2 text-lg font-medium">
            What would you like to work on today?
          </p>
        </div>

        {/* Scenario tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          {SCENARIOS.map(s => (
            <div
              key={s.key}
              className="scenario-card p-7 cursor-pointer group"
              onClick={() => navigate(`/chat/${s.key}`)}
            >
              <div className="flex items-start justify-between mb-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${s.iconClass}`}>
                  {SCENARIO_ICONS[s.key]}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-5">{s.description}</p>
              <button className="scenario-card-btn w-full py-2.5 px-4 rounded-xl border border-slate-200
                text-sm font-semibold text-slate-600 flex items-center justify-between transition-all">
                <span>Start session</span>
                <span>→</span>
              </button>
            </div>
          ))}
        </div>

        {/* Progress panel */}
        {notes.length > 0 && (() => {
          // Sessions per scenario
          const counts: Record<string, number> = {}
          for (const n of notes) counts[n.scenario] = (counts[n.scenario] || 0) + 1
          const total = notes.length

          // Weekly streak: count distinct calendar weeks with at least 1 session
          const weekSet = new Set(notes.map(n => {
            const d = new Date(n.created_at)
            const jan1 = new Date(d.getFullYear(), 0, 1)
            return `${d.getFullYear()}-W${Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)}`
          }))
          const streak = weekSet.size

          return (
            <div className="panel-card p-6 mb-8">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Your Progress
                </h2>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-amber-600">{streak} week{streak !== 1 ? 's' : ''} active</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {SCENARIOS.map(s => {
                  const count = counts[s.key] || 0
                  const dots = Math.min(count, 8)
                  return (
                    <div key={s.key} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.iconClass}`} style={{ transform: 'scale(0.85)' }}>
                          {SCENARIO_ICONS[s.key]}
                        </div>
                        <span className="text-xs font-semibold text-slate-600 truncate">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {Array.from({ length: dots }).map((_, i) => (
                          <span key={i} className="w-2.5 h-2.5 rounded-full"
                                style={{ background: s.key === 'interview' ? '#1C88FC' : s.key === 'inbox' ? '#8b5cf6' : '#10b981' }} />
                        ))}
                        {count === 0 && <span className="text-xs text-slate-300 font-medium">No sessions yet</span>}
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{count} session{count !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">{total} total session{total !== 1 ? 's' : ''} completed</span>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-primary/60" />
                  ))}
                  {total > 10 && <span className="text-xs text-slate-400 ml-1">+{total - 10}</span>}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Your Profile */}
        <div className="panel-card p-7 mb-12">
          <div className="flex items-center gap-2 mb-1">
            <Pencil className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold text-slate-800">Your Profile</h2>
          </div>
          <p className="text-sm text-slate-500 mb-5">
            {profileIsEmpty
              ? 'Add your details to personalise your coaching sessions →'
              : 'Keep this up to date so coaching stays relevant to you.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[
              { label: 'Studying', value: profileField,      setter: setProfileField,      placeholder: 'e.g. Computer Science' },
              { label: 'Goal',     value: profileTargetRole, setter: setProfileTargetRole, placeholder: 'e.g. Product Manager'  },
              { label: 'School',   value: profileSchool,     setter: setProfileSchool,     placeholder: 'e.g. Stanford'          },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm
                    placeholder:text-slate-300 text-slate-700 focus:outline-none focus:ring-2
                    focus:ring-primary/30 focus:border-primary/50 transition-all"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${profileSaved
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30'
              }`}
          >
            {profileSaved && <CheckCircle className="w-4 h-4" />}
            {profileSaved ? 'Saved!' : profileSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        {/* Recent sessions */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Recent sessions
          </h2>
          {notes.length === 0 ? (
            <div className="panel-card p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-7 h-7 text-primary/40" />
              </div>
              <p className="text-slate-400 text-sm font-medium">
                Complete your first session to start building your coaching history.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {notes.map((note, i) => {
                const firstBullet = note.notes.split('\n')[0].replace(/^[•\-*]\s*/, '').trim()
                const date = new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                return (
                  <div
                    key={i}
                    className="session-card p-5"
                    onClick={() => navigate(`/chat/${note.scenario}`)}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">{SCENARIO_EMOJI[note.scenario] || '💬'}</span>
                      <span className="text-sm font-semibold text-slate-700">
                        {SCENARIO_TITLES[note.scenario] || note.scenario}
                      </span>
                      <span className="text-xs text-slate-400 ml-auto">{date}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{firstBullet}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
