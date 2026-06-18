import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  streamChat, summarizeSession, saveProfile, getProfile, Message,
  getChatSessions, createChatSession, getChatSessionMessages,
  updateChatSession, deleteChatSession, ChatSession, SkillEvidence,
} from '../lib/api'
import {
  ArrowLeft, Send, Pencil, User, CheckCircle, Star, Zap,
  TrendingUp, ArrowRight, Download, Plus, Trash2, ChevronDown, ChevronUp, Target,
} from 'lucide-react'

// Skill keys + labels per scenario (mirrors backend SCENARIO_SKILLS)
const SCENARIO_SKILL_DEFS: Record<string, { key: string; label: string }[]> = {
  interview: [
    { key: 'storytelling', label: 'Storytelling' },
    { key: 'confidence',   label: 'Confidence' },
    { key: 'specificity',  label: 'Specificity' },
    { key: 'conciseness',  label: 'Conciseness' },
  ],
  email: [
    { key: 'clarity',         label: 'Clarity' },
    { key: 'professionalism', label: 'Professionalism' },
    { key: 'structure',       label: 'Structure' },
    { key: 'directness',      label: 'Directness' },
  ],
  inbox: [
    { key: 'prioritization', label: 'Prioritization' },
    { key: 'decisiveness',   label: 'Decisiveness' },
  ],
}

function skillColor(v: number): string {
  if (v >= 70) return '#10b981'
  if (v >= 45) return '#f59e0b'
  return '#ef4444'
}

const SCENARIOS: Record<string, { emoji: string; title: string; color: string }> = {
  interview: { emoji: '🎯', title: 'Interview Prep',  color: '#1C88FC' },
  inbox:     { emoji: '📥', title: 'Inbox Reset',    color: '#8b5cf6' },
  email:     { emoji: '✉️',  title: 'Email Writing',  color: '#10b981' },
}

export default function ChatPage() {
  const { scenario = 'interview' } = useParams<{ scenario: string }>()
  const meta     = SCENARIOS[scenario] || { emoji: '💬', title: scenario, color: '#1C88FC' }
  const navigate = useNavigate()

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [nudgeLimit, setNudgeLimit] = useState(2)
  const [loading,   setLoading]   = useState(true)

  // ── Session state ───────────────────────────────────────────────────────────
  const [sessions,         setSessions]         = useState<ChatSession[]>([])
  const [activeSessionId,  setActiveSessionId]  = useState<string | null>(null)
  const [showAllSessions,  setShowAllSessions]  = useState(false)
  const activeSessionIdRef = useRef<string | null>(null)
  useEffect(() => { activeSessionIdRef.current = activeSessionId }, [activeSessionId])

  // ── Refs ────────────────────────────────────────────────────────────────────
  const bottomRef    = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  // ── Debrief modal ───────────────────────────────────────────────────────────
  const [debriefState,   setDebriefState]   = useState<null | 'loading' | 'ready'>(null)
  const [debriefBullets, setDebriefBullets] = useState<string[]>([])
  const [debriefAction,  setDebriefAction]  = useState('')

  // ── Profile sidebar ─────────────────────────────────────────────────────────
  const [sidebarOpen,       setSidebarOpen]       = useState(false)
  const [profileField,      setProfileField]      = useState('')
  const [profileTargetRole, setProfileTargetRole] = useState('')
  const [profileSchool,     setProfileSchool]     = useState('')
  const [profileSaved,      setProfileSaved]      = useState(false)
  const [profileSaving,     setProfileSaving]     = useState(false)

  // ── Skills panel (scores + evidence for THIS scenario) ───────────────────────
  const [skillScores,   setSkillScores]   = useState<Record<string, number>>({})
  const [skillEvidence, setSkillEvidence] = useState<Record<string, SkillEvidence[]>>({})

  // ── Load profile + skills ──────────────────────────────────────────────────────
  useEffect(() => {
    getProfile().then((p) => {
      if (p) {
        setProfileField(p.field || '')
        setProfileTargetRole(p.target_role || '')
        setProfileSchool(p.school || '')
        setSkillScores(p.student_model?.skill_scores || {})
        setSkillEvidence(p.student_model?.skill_evidence || {})
      }
    }).catch(() => {})
  }, [])

  // ── Load sessions on mount ───────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    getChatSessions(scenario).then(async (sessionList) => {
      setSessions(sessionList)
      if (sessionList.length === 0) {
        // No sessions yet — create first one
        await startNewSessionInternal()
      } else {
        // Load the most recent session
        const latest = sessionList[0]
        setActiveSessionId(latest.id)
        const msgs = await getChatSessionMessages(latest.id)
        const clean = msgs.filter(m => !m.content.startsWith('Error:'))
        setMessages(clean)
        setLoading(false)
        if (clean.length === 0) sendOpener()
      }
    }).catch(() => {
      setLoading(false)
      sendOpener()
    })
  }, [scenario])

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function generateSessionName(): string {
    const date  = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const field = profileField      || ''
    const role  = profileTargetRole || ''
    if (field && role)  return `${field} → ${role} (${date})`
    if (field || role)  return `${field || role} (${date})`
    return `${meta.title} (${date})`
  }

  function scheduleSave(msgs: Message[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const id = activeSessionIdRef.current
      if (id) updateChatSession(id, msgs).catch(() => {})
    }, 1000)
  }

  async function startNewSessionInternal() {
    try {
      const name    = generateSessionName()
      const session = await createChatSession(scenario, name)
      activeSessionIdRef.current = session.id   // sync — so the opener's save lands in this session
      setActiveSessionId(session.id)
      setSessions(prev => [session, ...prev.filter(s => s.id !== session.id)])
      setMessages([])
      setLoading(false)
      sendOpener()
    } catch {
      // Session couldn't be created — show the opener anyway so the demo never stalls
      setLoading(false)
      sendOpener()
    }
  }

  function sendOpener() {
    sendMessage([{
      role: 'user',
      content: `[The student just selected the ${meta.title} scenario. Start directly with your opening for that coaching flow.]`,
    }], true)
  }

  function sendMessage(msgs: Message[], isOpener = false) {
    setStreaming(true)
    let accumulated = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    streamChat(
      msgs, scenario, nudgeLimit,
      (chunk) => {
        accumulated += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: accumulated }
          return updated
        })
      },
      () => {
        setStreaming(false)
        if (isOpener) {
          const opener = [{ role: 'assistant' as const, content: accumulated }]
          setMessages(opener)
          scheduleSave(opener)
        } else {
          setMessages(prev => { scheduleSave(prev); return prev })
        }
      },
      (err) => {
        setStreaming(false)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err}` }
          return updated
        })
      },
    )
  }

  // ── New Chat ──────────────────────────────────────────────────────────────────
  async function handleNewChat() {
    if (streaming || loading) return
    // Silently save current session
    const id = activeSessionIdRef.current
    if (id && messages.length > 0) updateChatSession(id, messages).catch(() => {})
    setMessages([])
    setLoading(true)
    await startNewSessionInternal()
  }

  // ── Switch session ────────────────────────────────────────────────────────────
  async function switchSession(id: string) {
    if (streaming || loading || id === activeSessionId) return
    setLoading(true)
    // Save current session first
    const currentId = activeSessionIdRef.current
    if (currentId && messages.length > 0) updateChatSession(currentId, messages).catch(() => {})
    setActiveSessionId(id)
    const msgs = await getChatSessionMessages(id)
    const clean = msgs.filter(m => !m.content.startsWith('Error:'))
    setMessages(clean)
    setLoading(false)
  }

  // ── Delete session ────────────────────────────────────────────────────────────
  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (streaming) return
    await deleteChatSession(id).catch(() => {})
    const remaining = sessions.filter(s => s.id !== id)
    setSessions(remaining)
    if (id === activeSessionId) {
      if (remaining.length > 0) {
        switchSession(remaining[0].id)
      } else {
        setMessages([])
        setLoading(true)
        await startNewSessionInternal()
      }
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────────
  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = '44px'
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    sendMessage(newMessages)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Debrief (Back to Dashboard only) ─────────────────────────────────────────
  function parseDebrief(summary: string) {
    const lines = summary.split('\n').map(l => l.trim()).filter(Boolean)
    const bullets: string[] = []
    let action = ''
    for (const line of lines) {
      if (line.startsWith('NEXT:')) action = line.replace('NEXT:', '').trim()
      else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))
        bullets.push(line.replace(/^[•\-*]\s*/, '').trim())
    }
    return { bullets, action }
  }

  async function handleBack() {
    if (messages.length < 4) { navigate('/dashboard'); return }
    setDebriefState('loading')
    try {
      // Never let the recap spinner hang — fall back to the dashboard after 15s
      const result = await Promise.race([
        summarizeSession(messages, scenario),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 15000)),
      ])
      if (result?.summary) {
        const { bullets, action } = parseDebrief(result.summary)
        setDebriefBullets(bullets)
        setDebriefAction(action)
        setDebriefState('ready')
      } else {
        navigate('/dashboard')
      }
    } catch {
      navigate('/dashboard')
    }
  }

  async function dismissDebrief() {
    setDebriefState(null)
    navigate('/dashboard')
  }

  // ── Download transcript ────────────────────────────────────────────────────────
  function handleDownloadTranscript() {
    const date  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const lines: string[] = [
      `HighView AI Coach — Session Transcript`,
      `Scenario: ${meta.title}`,
      `Date: ${date}`,
      `${'─'.repeat(50)}`, '',
    ]
    for (const msg of messages) {
      if (msg.content.startsWith('Error:') || msg.content.startsWith('[The student')) continue
      lines.push(`${msg.role === 'user' ? 'You' : 'Coach'}:`)
      lines.push(msg.content.trim())
      lines.push('')
    }
    lines.push('─'.repeat(50))
    lines.push('Generated by HighView AI Coach · highview.ai')
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `highview-${meta.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Save profile ──────────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    setProfileSaving(true)
    try {
      await saveProfile(profileField, profileTargetRole, profileSchool)
      setProfileSaved(true)
      // Auto-restart session with updated profile after brief "Saved!" moment
      setTimeout(async () => {
        setProfileSaved(false)
        setMessages([])
        setLoading(true)
        await startNewSessionInternal()
      }, 1200)
    } catch { /* ignore */ } finally {
      setProfileSaving(false)
    }
  }

  // ── Sessions visible in sidebar ────────────────────────────────────────────────
  const visibleSessions = showAllSessions ? sessions : sessions.slice(0, 5)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden relative"
         style={{ background: 'linear-gradient(160deg, #deeeff 0%, #f0f6ff 45%, #eef2ff 100%)' }}>

      {/* ── DEBRIEF MODAL ────────────────────────────────────────────────────── */}
      {debriefState && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-6"
             style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}>

          {debriefState === 'loading' && (
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center gap-4 max-w-sm w-full"
                 style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
              <div className="flex gap-1.5">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="w-3 h-3 rounded-full animate-bounce"
                        style={{ background: meta.color, animationDelay: `${delay}ms` }} />
                ))}
              </div>
              <p className="text-slate-500 text-sm font-medium">Saving your session recap…</p>
              <button onClick={() => navigate('/dashboard')}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-all">
                Skip to dashboard
              </button>
            </div>
          )}

          {debriefState === 'ready' && (
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full"
                 style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                     style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
                              boxShadow: `0 8px 24px ${meta.color}40` }}>🎓</div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">Session Complete!</h2>
                  <p className="text-sm text-slate-500">{meta.title} · here's what happened</p>
                </div>
              </div>

              {debriefBullets.length > 0 && (
                <div className="space-y-3 mb-6">
                  {debriefBullets.map((bullet, i) => {
                    const icons   = [
                      <TrendingUp key={0} className="w-4 h-4 shrink-0" style={{ color: meta.color }} />,
                      <Zap key={1} className="w-4 h-4 shrink-0 text-amber-500" />,
                      <Star key={2} className="w-4 h-4 shrink-0 text-emerald-500" />,
                    ]
                    const labels  = ['Worked on', 'To improve', 'Did well']
                    const colors  = [
                      { bg: `${meta.color}10`, border: `${meta.color}25` },
                      { bg: '#fef3c710', border: '#fde68a50' },
                      { bg: '#d1fae510', border: '#6ee7b750' },
                    ]
                    return (
                      <div key={i} className="flex gap-3 p-3 rounded-2xl border"
                           style={{ background: colors[i]?.bg || '#f8fafc', borderColor: colors[i]?.border || '#e2e8f0' }}>
                        <div className="mt-0.5">{icons[i]}</div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            {labels[i] || ''}
                          </span>
                          <p className="text-sm text-slate-700 leading-relaxed">{bullet}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {debriefAction && (
                <div className="rounded-2xl p-4 mb-6 border border-blue-200"
                     style={{ background: `${meta.color}08` }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: meta.color }}>
                    Before next time
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{debriefAction}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={dismissDebrief}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all"
                  style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                           boxShadow: `0 4px 20px ${meta.color}40` }}>
                  Back to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={dismissDebrief}
                  className="px-5 py-3.5 rounded-2xl text-sm font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-blue-100/80 z-50"
              style={{ boxShadow: '0 2px 16px rgba(28,136,252,0.07)' }}>
        <div className="w-full px-4 h-16 flex items-center gap-3">
          <button onClick={handleBack}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500
              hover:text-primary hover:bg-blue-50 transition-all shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <img src="/highview-logo.png" alt="HighView" className="h-6 w-auto hidden sm:block" />

          <button onClick={() => setSidebarOpen(prev => !prev)}
            className="sm:hidden shrink-0 p-2 rounded-xl hover:bg-blue-50 transition-all"
            aria-label="Toggle sidebar">
            <User className="w-4 h-4 text-slate-500" />
          </button>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xl">{meta.emoji}</span>
            <h1 className="font-bold text-slate-800 truncate">{meta.title}</h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Nudges:</label>
              <select value={nudgeLimit} onChange={e => setNudgeLimit(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white
                  text-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary/50">
                {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={handleDownloadTranscript} disabled={messages.length === 0}
              title="Download transcript"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                text-slate-500 hover:text-primary hover:bg-blue-50 transition-all disabled:opacity-30">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Save</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 w-full">

        {/* ── SIDEBAR ────────────────────────────────────────────────────────── */}
        <>
          {sidebarOpen && (
            <div className="sm:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
                 onClick={() => setSidebarOpen(false)} />
          )}

          <aside className={`
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            sm:translate-x-0
            fixed sm:static top-16 left-0 bottom-0
            z-40 sm:z-auto
            w-64 shrink-0
            flex flex-col
            overflow-y-auto
            transition-transform duration-200 ease-in-out
          `} style={{
            background: 'white',
            borderRight: '1px solid rgba(28,136,252,0.08)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.04)',
          }}>

            {/* ── New Chat button ── */}
            <div className="px-4 pt-4 pb-3">
              <button onClick={handleNewChat} disabled={streaming}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                  text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                         boxShadow: `0 4px 16px ${meta.color}30` }}>
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {/* ── Past Sessions ── */}
            {sessions.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Past Sessions
                </p>
                <div className="space-y-1">
                  {visibleSessions.map(session => (
                    <div key={session.id}
                      className={`group flex items-center gap-1 rounded-xl px-2 py-2 cursor-pointer transition-all ${
                        session.id === activeSessionId
                          ? 'text-white'
                          : 'hover:bg-slate-50 text-slate-600'
                      }`}
                      style={session.id === activeSessionId
                        ? { background: meta.color, boxShadow: `0 2px 12px ${meta.color}40` }
                        : {}}
                      onClick={() => switchSession(session.id)}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${
                          session.id === activeSessionId ? 'text-white' : 'text-slate-700'
                        }`}>
                          {session.name}
                        </p>
                        <p className={`text-xs mt-0.5 ${
                          session.id === activeSessionId ? 'text-white/70' : 'text-slate-400'
                        }`}>
                          {new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className={`shrink-0 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${
                          session.id === activeSessionId
                            ? 'hover:bg-white/20 text-white'
                            : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                        }`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {sessions.length > 5 && (
                  <button onClick={() => setShowAllSessions(!showAllSessions)}
                    className="w-full mt-2 text-xs font-semibold text-slate-400 hover:text-slate-600
                      py-1.5 rounded-lg hover:bg-slate-50 transition-all">
                    {showAllSessions
                      ? 'Show less'
                      : `Show ${sessions.length - 5} more`}
                  </button>
                )}
              </div>
            )}

            {/* ── Divider ── */}
            <div className="mx-4 border-t border-slate-100 mb-3" />

            {/* ── Profile section ── */}
            <div className="px-4 pb-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg icon-box-blue flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Your Profile</h2>
            </div>

            <div className="flex flex-col gap-3 flex-1 px-4">
              {[
                { label: 'Studying', value: profileField,      setter: setProfileField,      placeholder: 'e.g. Computer Science' },
                { label: 'Goal',     value: profileTargetRole, setter: setProfileTargetRole, placeholder: 'e.g. Product Manager'  },
                { label: 'School',   value: profileSchool,     setter: setProfileSchool,     placeholder: 'e.g. Stanford'          },
              ].map(({ label, value, setter, placeholder }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm
                      text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
                      focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
              ))}
            </div>

            <div className="px-4 py-4">
              <button onClick={handleSaveProfile} disabled={profileSaving}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                  ${profileSaved
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30'
                  }`}>
                {profileSaved && <CheckCircle className="w-4 h-4" />}
                {profileSaved ? 'Saved!' : profileSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </aside>
        </>

        {/* ── CHAT COLUMN ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">

          {/* Messages */}
          <main className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="flex gap-1.5">
                  {[0,150,300].map(d => (
                    <span key={d} className="w-2.5 h-2.5 rounded-full animate-bounce"
                          style={{ background: meta.color, opacity: 0.5, animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-base shrink-0 mb-0.5"
                         style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                                  boxShadow: `0 4px 12px ${meta.color}40` }}>
                      🎓
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white text-slate-700 rounded-bl-sm'
                  }`} style={msg.role === 'user'
                    ? { background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)`,
                        boxShadow: `0 4px 16px ${meta.color}35` }
                    : { boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid rgba(28,136,252,0.06)' }
                  }>
                    {msg.content || (streaming && i === messages.length - 1 ? (
                      <span className="flex gap-1 py-0.5">
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
                    ) : '')}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </main>

          {/* Input bar */}
          <div className="shrink-0 px-4 py-4"
               style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)',
                        borderTop: '1px solid rgba(28,136,252,0.08)' }}>
            <div className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  scenario === 'email'
                    ? 'Paste your email situation or draft here, or just say what you need to write…'
                    : scenario === 'inbox'
                    ? 'Describe your inbox situation, or say "student" or "work" to get started…'
                    : 'Type your message… (Enter to send, Shift+Enter for new line)'
                }
                rows={1}
                disabled={streaming || loading}
                className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm
                  text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2
                  focus:ring-primary/30 focus:border-primary/50 transition-all
                  disabled:opacity-50 max-h-32 overflow-y-auto"
                style={{ minHeight: '44px' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
                }}
              />
              <button onClick={handleSend} disabled={!input.trim() || streaming || loading}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white
                  transition-all disabled:opacity-40 shrink-0"
                style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                         boxShadow: `0 4px 16px ${meta.color}40` }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL: scores + reasons for THIS scenario ──────────────────── */}
        {(() => {
          const defs = SCENARIO_SKILL_DEFS[scenario] || []
          const scored = defs.filter(d => skillScores[d.key] !== undefined)
          if (scored.length === 0) return null
          return (
            <aside className="hidden xl:flex flex-col w-72 shrink-0 overflow-y-auto px-4 py-5 gap-3"
                   style={{ background: 'white', borderLeft: '1px solid rgba(28,136,252,0.08)' }}>
              <div className="flex items-center gap-2 pb-2">
                <Target className="w-4 h-4" style={{ color: meta.color }} />
                <h2 className="text-sm font-bold text-slate-800">Your {meta.title} Skills</h2>
              </div>
              <p className="text-xs text-slate-400 -mt-1 mb-1">Tap a skill to see why you're at that score.</p>
              {scored.map(d => (
                <ChatSkillRow
                  key={d.key}
                  label={d.label}
                  value={skillScores[d.key]}
                  evidence={skillEvidence[d.key] || []}
                />
              ))}
            </aside>
          )
        })()}
      </div>
    </div>
  )
}

// ── Right-panel skill row: bar + score + expandable "why" ─────────────────────
function ChatSkillRow({ label, value, evidence }: {
  label: string; value: number; evidence: SkillEvidence[]
}) {
  const [open, setOpen] = useState(false)
  const color = skillColor(value)
  const hasEvidence = evidence.length > 0
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div
        className={`flex items-center justify-between gap-2 ${hasEvidence ? 'cursor-pointer' : ''}`}
        onClick={() => hasEvidence && setOpen(o => !o)}
      >
        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          {hasEvidence && (open
            ? <ChevronUp className="w-3 h-3 text-slate-400" />
            : <ChevronDown className="w-3 h-3 text-slate-300" />)}
          {label}
        </span>
        <span className="text-xs font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
      {open && hasEvidence && (
        <div className="mt-2.5 pl-2 border-l-2 space-y-2" style={{ borderColor: `${color}40` }}>
          {[...evidence].reverse().map((ev, i) => (
            <div key={i}>
              <p className="text-xs text-slate-600 leading-relaxed">{ev.note}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · scored {ev.score}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
