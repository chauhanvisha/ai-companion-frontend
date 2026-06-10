import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSessionNotes, getProfile, saveProfile,
  getCheckinStatus, saveCheckin, saveWeeklyCheckinToggle,
  getScoreHistory, changePassword,
  SessionNote, StudentModel, CheckinData, ScoreSnapshot, SkillEvidence, parseSessionNotes,
} from '../lib/api'
import {
  LogOut, ArrowRight, Clock, Pencil, Mic, Inbox, Mail,
  CheckCircle, Flame, Trophy, ChevronDown, ChevronUp, Target,
  CalendarCheck, X, Star, KeyRound,
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
const SCENARIO_GRADIENT: Record<string, string> = {
  interview: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
  inbox:     'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
  email:     'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
}
const SCENARIO_IMG: Record<string, string> = {
  interview: '/Consulting-rafiki.png',
  inbox:     '/Inbox cleanup-amico.png',
  email:     '/Editing body text-amico.png',
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

function SkillBar({ label, value, history, evidence }: {
  label: string; value: number; history?: number[]; evidence?: SkillEvidence[]
}) {
  const [open, setOpen] = useState(false)
  const color = scoreColor(value)
  const first = history && history.length > 1 ? history[0] : null
  const delta = first !== null ? value - first : 0
  const hasEvidence = !!(evidence && evidence.length > 0)

  return (
    <div>
      <div
        className={`flex items-center gap-3 ${hasEvidence ? 'cursor-pointer group' : ''}`}
        onClick={() => hasEvidence && setOpen(o => !o)}
      >
        <span className="text-xs text-slate-500 w-24 flex-shrink-0 truncate flex items-center gap-1">
          {hasEvidence && (
            open
              ? <ChevronUp className="w-3 h-3 text-slate-400 flex-shrink-0" />
              : <ChevronDown className="w-3 h-3 text-slate-300 group-hover:text-slate-400 flex-shrink-0" />
          )}
          {label}
        </span>
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
        </div>
        {history && history.length > 1
          ? <Sparkline data={history} color={color} />
          : <span className="w-16" />
        }
        <div className="flex items-center gap-1 w-14 justify-end flex-shrink-0">
          <span className="text-xs font-bold" style={{ color }}>{value}</span>
          {delta !== 0 && (
            <span className="text-xs font-medium" style={{ color: delta > 0 ? '#10b981' : '#ef4444' }}>
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>
      </div>

      {/* Evidence drill-down — why this score is what it is */}
      {open && hasEvidence && (
        <div className="mt-2 ml-1 pl-3 border-l-2 space-y-2" style={{ borderColor: `${color}40` }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Why you're at {value}
          </p>
          {[...evidence!].reverse().map((ev, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-md flex-shrink-0"
                    style={{ background: `${scoreColor(ev.score)}15`, color: scoreColor(ev.score) }}>
                {ev.score}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-slate-600 leading-relaxed">{ev.note}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sparkline (pure SVG, no library) ────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 64, H = 22, PAD = 2
  const vals = data.slice(-8)  // show last 8 points max
  if (vals.length < 2) return <span className="w-16 inline-block" />
  const min  = Math.min(...vals) - 5
  const max  = Math.max(...vals) + 5
  const rng  = Math.max(max - min, 1)
  const step = (W - PAD * 2) / (vals.length - 1)
  const pts  = vals.map((v, i) => {
    const x = PAD + i * step
    const y = H - PAD - ((v - min) / rng) * (H - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      {/* last point dot */}
      {(() => {
        const last = pts.split(' ').pop()!.split(',')
        return <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
      })()}
    </svg>
  )
}

// ─── Weekly check-in card ─────────────────────────────────────────────────────

type CheckinStep = 'q1' | 'q2' | 'q3' | 'done'

function CheckinCard({ onComplete, onDismiss }: {
  onComplete: (data: Omit<CheckinData, 'created_at'>) => void
  onDismiss:  () => void
}) {
  const [step,             setStep]             = useState<CheckinStep>('q1')
  const [followedThrough,  setFollowedThrough]  = useState<string>('')
  const [confidenceRating, setConfidenceRating] = useState<number>(0)
  const [focusThisWeek,    setFocusThisWeek]    = useState('')
  const [saving,           setSaving]           = useState(false)

  async function handleSubmit() {
    setSaving(true)
    await onComplete({ followed_through: followedThrough, confidence_rating: confidenceRating, focus_this_week: focusThisWeek })
    setSaving(false)
  }

  return (
    <div className="panel-card p-6 mb-8 relative" style={{ borderLeft: '3px solid #1C88FC' }}>
      <button onClick={onDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
          <CalendarCheck className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Weekly Check-in</h3>
          <p className="text-xs text-slate-400">Quick 3 questions — takes 30 seconds</p>
        </div>
        <div className="ml-auto flex gap-1">
          {(['q1','q2','q3'] as CheckinStep[]).map((s, i) => (
            <span key={i} className="w-2 h-2 rounded-full transition-colors"
              style={{ background: ['q1','q2','q3'].indexOf(step) >= i ? '#1C88FC' : '#e2e8f0' }} />
          ))}
        </div>
      </div>

      {step === 'q1' && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">Did you follow through on your last action item?</p>
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'yes',       label: '✅ Yes, fully' },
              { value: 'partially', label: '⚡ Partially' },
              { value: 'no',        label: '❌ Not yet' },
            ].map(opt => (
              <button key={opt.value}
                onClick={() => { setFollowedThrough(opt.value); setStep('q2') }}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                  ${followedThrough === opt.value
                    ? 'bg-primary text-white border-primary'
                    : 'border-slate-200 text-slate-600 hover:border-primary/40 hover:bg-blue-50'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'q2' && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">How confident are you feeling this week?</p>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(n => (
              <button key={n}
                onClick={() => { setConfidenceRating(n); setStep('q3') }}
                className="flex flex-col items-center gap-1 group">
                <Star
                  className="w-8 h-8 transition-all"
                  style={{
                    fill:   confidenceRating >= n ? '#f59e0b' : 'none',
                    stroke: confidenceRating >= n ? '#f59e0b' : '#cbd5e1',
                  }}
                />
                <span className="text-xs text-slate-400">{n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'q3' && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-3">What do you want to focus on this week?</p>
          <textarea
            value={focusThisWeek}
            onChange={e => setFocusThisWeek(e.target.value)}
            placeholder="e.g. Get better at answering conflict questions, or practice cold outreach emails…"
            rows={2}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm
              placeholder:text-slate-300 text-slate-700 focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary/50 resize-none transition-all mb-3"
          />
          <button
            onClick={handleSubmit}
            disabled={saving || !focusThisWeek.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary text-white
              hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {saving ? 'Saving…' : 'Done →'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Got it!</span> Your coach will reference this in your next session.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const username = localStorage.getItem('username') || 'there'
  const navigate = useNavigate()

  const [notes,          setNotes]          = useState<SessionNote[]>([])
  const [studentModel,   setStudentModel]   = useState<StudentModel | null>(null)
  const [scoreSnapshots, setScoreSnapshots] = useState<ScoreSnapshot[]>([])

  // Check-in state
  const [checkinEnabled,  setCheckinEnabled]  = useState(false)
  const [checkinDue,      setCheckinDue]      = useState(false)
  const [checkinDismissed,setCheckinDismissed]= useState(false)
  const [checkinDone,     setCheckinDone]     = useState(false)

  const [profileField,      setProfileField]      = useState('')
  const [profileTargetRole, setProfileTargetRole] = useState('')
  const [profileSchool,     setProfileSchool]     = useState('')
  const [profileLoaded,     setProfileLoaded]     = useState(false)
  const [profileSaved,      setProfileSaved]      = useState(false)
  const [profileSaving,     setProfileSaving]     = useState(false)

  useEffect(() => {
    getSessionNotes().then(setNotes).catch(() => {})
    getScoreHistory().then(setScoreSnapshots).catch(() => {})
    getProfile().then((p) => {
      if (p) {
        setProfileField(p.field || '')
        setProfileTargetRole(p.target_role || '')
        setProfileSchool(p.school || '')
        if (p.student_model) setStudentModel(p.student_model)
        if (p.weekly_checkin_enabled) setCheckinEnabled(true)
      }
      setProfileLoaded(true)
    }).catch(() => setProfileLoaded(true))
    getCheckinStatus().then((s) => {
      setCheckinEnabled(s.enabled)
      setCheckinDue(s.isDue)
    }).catch(() => {})
  }, [])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    navigate('/')
  }

  // Change password
  const [showChangePw,    setShowChangePw]    = useState(false)
  const [currentPw,       setCurrentPw]       = useState('')
  const [newPw,           setNewPw]           = useState('')
  const [confirmPw,       setConfirmPw]       = useState('')
  const [pwError,         setPwError]         = useState('')
  const [pwSaved,         setPwSaved]         = useState(false)
  const [pwSaving,        setPwSaving]        = useState(false)

  async function handleChangePassword() {
    setPwError('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 6)    { setPwError('Password must be at least 6 characters'); return }
    setPwSaving(true)
    try {
      await changePassword(currentPw, newPw)
      setPwSaved(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setPwSaved(false); setShowChangePw(false) }, 2000)
    } catch (err: any) {
      setPwError(err.message)
    } finally {
      setPwSaving(false)
    }
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

  async function handleCheckinToggle(enabled: boolean) {
    setCheckinEnabled(enabled)
    await saveWeeklyCheckinToggle(enabled).catch(() => {})
    // If just enabled and they've never done one, show it immediately
    if (enabled) setCheckinDue(true)
  }

  async function handleCheckinComplete(data: Omit<CheckinData, 'created_at'>) {
    await saveCheckin(data).catch(() => {})
    setCheckinDone(true)
    setCheckinDue(false)
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

  // Build per-skill history arrays from snapshots (chronological)
  // skillHistory[skillKey] = [45, 52, 61, 71, ...]
  const skillHistory: Record<string, number[]> = {}
  for (const snap of scoreSnapshots) {
    for (const [key, val] of Object.entries(snap.scores)) {
      if (!skillHistory[key]) skillHistory[key] = []
      skillHistory[key].push(val)
    }
  }
  // Append current value if different from last snapshot
  if (studentModel?.skill_scores) {
    for (const [key, current] of Object.entries(studentModel.skill_scores)) {
      const hist = skillHistory[key] || []
      if (hist.length === 0 || hist[hist.length - 1] !== current) {
        skillHistory[key] = [...hist, current]
      }
    }
  }

  // Skill groups
  const skillGroups: { scenarioKey: string; title: string; scores: { key: string; label: string; value: number; history: number[]; evidence: SkillEvidence[] }[] }[] = []
  if (studentModel?.skill_scores && Object.keys(studentModel.skill_scores).length > 0) {
    for (const { key: scenarioKey, title } of SCENARIOS) {
      const scores = (SCENARIO_SKILL_KEYS[scenarioKey] || [])
        .filter(k => studentModel.skill_scores![k] !== undefined)
        .map(k => ({
          key: k,
          label: SKILL_LABELS[k] || k,
          value: studentModel.skill_scores![k],
          history: skillHistory[k] || [],
          evidence: studentModel.skill_evidence?.[k] || [],
        }))
      if (scores.length > 0) skillGroups.push({ scenarioKey, title, scores })
    }
  }

  return (
    <div className="min-h-screen">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-blue-100/80"
           style={{ boxShadow: '0 2px 16px rgba(28,136,252,0.07)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/highview-logo.png" alt="HighView" className="h-7 w-auto" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 hidden sm:block font-medium">Hi, {username}!</span>
            <button onClick={() => setShowChangePw(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-500
                hover:text-slate-700 hover:bg-slate-100 transition-all">
              <KeyRound className="w-4 h-4" />
              <span className="hidden sm:inline">Change Password</span>
            </button>
            <button onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-500
                hover:text-slate-700 hover:bg-slate-100 transition-all">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>

          {/* Change Password Modal */}
          {showChangePw && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                 style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)' }}>
              <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                      <KeyRound className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-800">Change Password</h2>
                  </div>
                  <button onClick={() => { setShowChangePw(false); setPwError(''); setCurrentPw(''); setNewPw(''); setConfirmPw('') }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-all">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Current Password', value: currentPw, setter: setCurrentPw },
                    { label: 'New Password',     value: newPw,     setter: setNewPw },
                    { label: 'Confirm Password', value: confirmPw, setter: setConfirmPw },
                  ].map(({ label, value, setter }) => (
                    <div key={label} className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
                      <input
                        type="password"
                        value={value}
                        onChange={e => setter(e.target.value)}
                        placeholder={`Enter ${label.toLowerCase()}`}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm
                          text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
                          focus:ring-primary/30 focus:border-primary/50 transition-all"
                      />
                    </div>
                  ))}

                  {pwError && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600 font-medium">
                      {pwError}
                    </div>
                  )}

                  <button
                    onClick={handleChangePassword}
                    disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 mt-2
                      ${pwSaved
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30 disabled:opacity-50'
                      }`}
                  >
                    {pwSaved && <CheckCircle className="w-4 h-4" />}
                    {pwSaved ? 'Password Updated!' : pwSaving ? 'Saving…' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">

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

        {/* Weekly Check-in card — shown when due and not dismissed */}
        {checkinEnabled && checkinDue && !checkinDismissed && !checkinDone && (
          <CheckinCard
            onComplete={handleCheckinComplete}
            onDismiss={() => setCheckinDismissed(true)}
          />
        )}
        {checkinDone && (
          <div className="panel-card p-4 mb-8 flex items-center gap-3" style={{ borderLeft: '3px solid #10b981' }}>
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-slate-600">
              <span className="font-semibold">Check-in saved!</span> Your coach will reference this at the start of your next session.
            </p>
          </div>
        )}

        {/* Scenario tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          {SCENARIOS.map(s => (
            <div key={s.key} className="scenario-card cursor-pointer group overflow-hidden"
                 onClick={() => navigate(`/chat/${s.key}`)}>

              {/* Illustration area */}
              <div
                className="relative flex items-end justify-center overflow-hidden"
                style={{
                  height: 180,
                  background: SCENARIO_GRADIENT[s.key],
                }}
              >
                {/* subtle radial glow behind image */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(ellipse at 50% 60%, ${SCENARIO_COLOR[s.key]}22 0%, transparent 70%)`,
                }} />
                <img
                  src={SCENARIO_IMG[s.key]}
                  alt={s.title}
                  className="relative z-10 transition-transform duration-500 group-hover:scale-105 group-hover:-translate-y-1"
                  style={{
                    height: 158,
                    width: 'auto',
                    objectFit: 'contain',
                    filter: `drop-shadow(0px 12px 20px ${SCENARIO_COLOR[s.key]}55)`,
                  }}
                />
                {/* bottom fade into card */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 32,
                  background: 'linear-gradient(to bottom, transparent, white)',
                }} />
              </div>

              {/* Text body */}
              <div className="px-6 pt-4 pb-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-slate-800">{s.title}</h3>
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all mt-0.5 flex-shrink-0" />
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mb-5">{s.description}</p>
                <button className="scenario-card-btn w-full py-2.5 px-4 rounded-xl border border-slate-200
                  text-sm font-semibold text-slate-600 flex items-center justify-between transition-all">
                  <span>Start session</span>
                  <span>→</span>
                </button>
              </div>
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
                    {scores.map(s => <SkillBar key={s.key} label={s.label} value={s.value} history={s.history} evidence={s.evidence} />)}
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

        {/* Progress + Profile side by side */}
        <div className={`grid gap-6 mb-8 items-start ${totalSessions > 0 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>

        {/* Progress panel */}
        {totalSessions > 0 && (
          <div className="panel-card p-6 h-full">
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
        <div className="panel-card p-7">
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
          <div className="flex items-center justify-between flex-wrap gap-4">
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

            {/* Weekly check-in toggle */}
            <button
              onClick={() => handleCheckinToggle(!checkinEnabled)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all
                ${checkinEnabled
                  ? 'bg-blue-50 border-primary/30 text-primary'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Weekly check-in</span>
              {/* Toggle pill */}
              <span className={`relative inline-flex w-8 h-4 rounded-full transition-colors flex-shrink-0
                ${checkinEnabled ? 'bg-primary' : 'bg-slate-200'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
                  ${checkinEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </div>
        </div>

        </div>{/* end Progress + Profile grid */}

      </main>
    </div>
  )
}
