import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSessionNotes, getProfile, saveProfile,
  SessionNote, StudentModel, parseSessionNotes,
} from '../lib/api'
import {
  LogOut, ArrowRight, Clock, Pencil, Mic, Inbox, Mail,
  CheckCircle, Flame, Trophy, ChevronDown, ChevronUp, Target,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  interview: <Mic   className="w-6 h-6 text-white" />,
  inbox:     <Inbox className="w-6 h-6 text-white" />,
  email:     <Mail  className="w-6 h-6 text-white" />,
}
const SCENARIO_EMOJI: Record<string, string> = {
  interview: '🎯', inbox: '📥', email: '✉️',
}
const SCENARIO_COLOR: Record<string, string> = {
  interview: '#1C88FC', inbox: '#8b5cf6', email: '#10b981',
}
const SCENARIO_BG: Record<string, string> = {
  interview: 'rgba(28,136,252,0.08)', inbox: 'rgba(139,92,246,0.08)', email: 'rgba(16,185,129,0.08)',
}

const SCENARIOS = [
  { key: 'interview', title: 'Interview Prep',  description: 'Leave with 2–3 sharper answers and feedback you can act on today.', iconClass: 'icon-box-blue'   },
  { key: 'inbox',     title: 'Inbox Reset',      description: 'Leave with a 4-step triage system you can use on your inbox right now.', iconClass: 'icon-box-violet' },
  { key: 'email',     title: 'Email Writing',    description: 'Leave with a draft you can actually send — polished and ready to go.', iconClass: 'icon-box-green'  },
]
const SCENARIO_TITLES: Record<string, string> = Object.fromEntries(SCENARIOS.map(s => [s.key, s.title]))

const SKILL_LABELS: Record<string, string> = {
  storytelling:    'Storytelling',
  confidence:      'Confidence',
  specificity:     'Specificity',
  conciseness:     'Conciseness',
  clarity:         'Clarity',
  professionalism: 'Professionalism',
  structure:       'Structure',
  directness:      'Directness',
  prioritization:  'Prioritization',
  decisiveness:    'Decisiveness',
}

const SCENARIO_SKILL_KEYS: Record<string, string[]> = {
  interview: ['storytelling', 'confidence', 'specificity', 'conciseness'],
  email:     ['clarity', 'professionalism', 'structure', 'directness'],
  inbox:     ['prioritization', 'decisiveness'],
}

function scoreColor(v: number) {
  if (v >= 80) return '#10b981'
  if (v >= 60) return '#1C88FC'
  if (v >= 40) return '#f59e0b'
  return '#ef4444'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionCard({ note, onClick }: { note: SessionNote; onClick: () => void }) {
  const [open, setOpen] = useState(false)
  const { bullets, action } = parseSessionNotes(note.notes)
  const date  = new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const color = SCENARIO_COLOR[note.scenario] || '#1C88FC'
  const bg    = SCENARIO_BG[note.scenario]    || 'rgba(28,136,252,0.08)'

  return (
    <div className="session-card overflow-hidden" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-center gap-2 p-5 pb-3">
        <span className="text-lg">{SCENARIO_EMOJI[note.scenario] || '💬'}</span>
        <span className="text-sm font-semibold text-slate-700 flex-1 truncate">
          {SCENARIO_TITLES[note.scenario] || note.scenario}
        </span>
        <span className="text-xs text-slate-400 mr-2">{date}</span>
        <button
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
          className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
      </div>

      <div className="px-5 pb-3">
        {bullets[0] && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{bullets[0]}</p>}
      </div>

      {open && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-3 space-y-2">
          {bullets.slice(1).map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px]" style={{ background: color }} />
              <p className="text-xs text-slate-500 leading-relaxed">{b}</p>
            </div>
          ))}
          {action && (
            <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: bg }}>
              <p className="text-xs font-semibold mb-0.5" style={{ color }}>Next action</p>
              <p className="text-xs text-slate-600 leading-relaxed">{action}</p>
            </div>
          )}
          <button
            onClick={onClick}
            className="mt-3 w-full py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{ borderColor: color, color, background: bg }}
          >
            Continue this scenario →
          </button>
        </div>
      )}
    </div>
  )
}

function SkillBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-28 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{value}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const username = localStorage.getItem('username') || 'there'
  const navigate = useNavigate()

  const [notes,        setNotes]        = useState<SessionNote[]>([])
  const [studentModel, setStudentModel] = useState<StudentModel | null>(null)

  const [profileField,      setProfileField]      = useState('')
  const [profileTargetRole, setProfileTargetRole] = useState('')
  const [profileSchool,     setProfileSchool]     = useState('')
  const [profileLoaded,     setProfileLoaded]     = useState(false)
  const [profileSaved,      setProfileSaved]      = useState(false)
  const [profileSaving,     setProfileSaving]     = useState(false)

  useEffect(() => {
    getSessionNotes().then(setNotes).catch(() => {})
    getProfile().then((p) => {
      if (p) {
        setProfileField(p.field || '')
        setProfileTargetRole(p.target_role || '')
        setProfileSchool(p.school || '')
        if (p.student_model) setStudentModel(p.student_model)
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
    } catch { /* ignore */ } finally {
      setProfileSaving(false)
    }
  }

  const profileIsEmpty = profileLoaded && !profileField && !profileTargetRole && !profileSchool

  // Stats
  const totalSessions = notes.length
  const thisWeek = notes.filter(n =>
    (Date.now() - new Date(n.created_at).getTime()) / (1000 * 60 * 60 * 24) <= 7
  ).length
  const weekSet = new Set(notes.map(n => {
    const d = new Date(n.created_at)
    const jan1 = new Date(d.getFullYear(), 0, 1)
    return `${d.getFullYear()}-W${Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)}`
  }))
  const weeksActive = weekSet.size
  const countByScenario: Record<string, number> = {}
  for (const n of notes) countByScenario[n.scenario] = (countByScenario[n.scenario] || 0) + 1

  // Skill groups
  const skillGroups: { scenarioKey: string; title: string; scores: { key: string; label: string; value: number }[] }[] = []
  if (studentModel?.skill_scores && Object.keys(studentModel.skill_scores).length > 0) {
    for (const { key: scenarioKey, title } of SCENARIOS) {
      const scores = (SCENARIO_SKILL_KEYS[scenarioKey] || [])
        .filter(k => studentModel.skill_scores![k] !== undefined)
        .map(k => ({ key: k, label: SKILL_LABELS[k] || k, value: studentModel.skill_scores![k] }))
      if (scores.length > 0) skillGroups.push({ scenarioKey, title, scores })
    }
  }

  return (
    <div className="min-h-screen">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-blue-100/80"
           style={{ boxShadow: '0 2px 16px rgba(28,136,252,0.07)' }}>
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/highview-logo.png" alt="HighView" className="h-7 w-auto" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:block font-medium">Hi, {username}!</span>
            <button onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-500
                hover:text-slate-700 hover:bg-slate-100 transition-all">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">

        {/* Greeting */}
        <div className="mb-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">Hi, {username}! 👋</h1>
            <p className="text-slate-500 mt-2 text-lg font-medium">What would you like to work on today?</p>
          </div>
          {totalSessions > 0 && (
            <div className="flex items-center gap-3">
              <div className="panel-card px-4 py-3 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-lg font-extrabold text-slate-800 leading-none">{thisWeek}</p>
                  <p className="text-xs text-slate-400 font-medium">this week</p>
                </div>
              </div>
              <div className="panel-card px-4 py-3 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-lg font-extrabold text-slate-800 leading-none">{totalSessions}</p>
                  <p className="text-xs text-slate-400 font-medium">total</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scenario tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          {SCENARIOS.map(s => (
            <div key={s.key} className="scenario-card p-7 cursor-pointer group"
                 onClick={() => navigate(`/chat/${s.key}`)}>
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

        {/* Skill Scores */}
        {skillGroups.length > 0 && (
          <div className="panel-card p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Your Skills
              </h2>
              {studentModel?.sessions_total && (
                <span className="text-xs text-slate-400 font-medium">
                  Based on {studentModel.sessions_total} session{studentModel.sessions_total !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {skillGroups.map(({ scenarioKey, title, scores }) => (
                <div key={scenarioKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{SCENARIO_EMOJI[scenarioKey]}</span>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</span>
                  </div>
                  <div className="space-y-2.5">
                    {scores.map(s => <SkillBar key={s.key} label={s.label} value={s.value} />)}
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const all = skillGroups.flatMap(g => g.scores).sort((a, b) => a.value - b.value)
              const lowest = all[0]
              if (!lowest || lowest.value >= 70) return null
              return (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0 mt-[5px]" style={{ background: scoreColor(lowest.value) }} />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-700">{SKILL_LABELS[lowest.key] || lowest.key}</span>
                    {' '}is your current growth area ({lowest.value}/100) — the AI will actively focus on this in your next session.
                  </p>
                </div>
              )
            })()}
          </div>
        )}

        {/* Progress panel */}
        {totalSessions > 0 && (
          <div className="panel-card p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Your Progress
              </h2>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-amber-600">{weeksActive} week{weeksActive !== 1 ? 's' : ''} active</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {SCENARIOS.map(s => {
                const count = countByScenario[s.key] || 0
                return (
                  <div key={s.key} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.iconClass}`}
                           style={{ transform: 'scale(0.85)' }}>
                        {SCENARIO_ICONS[s.key]}
                      </div>
                      <span className="text-xs font-semibold text-slate-600 truncate">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                        <span key={i} className="w-2.5 h-2.5 rounded-full"
                              style={{ background: SCENARIO_COLOR[s.key] }} />
                      ))}
                      {count === 0 && <span className="text-xs text-slate-300 font-medium">No sessions yet</span>}
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{count} session{count !== 1 ? 's' : ''}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">{totalSessions} total session{totalSessions !== 1 ? 's' : ''} completed</span>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalSessions, 10) }).map((_, i) => (
                  <span key={i} className="w-2 h-2 rounded-full bg-primary/60" />
                ))}
                {totalSessions > 10 && <span className="text-xs text-slate-400 ml-1">+{totalSessions - 10}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Profile */}
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
                : 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30'}`}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {notes.map((note, i) => (
                <SessionCard key={i} note={note} onClick={() => navigate(`/chat/${note.scenario}`)} />
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
