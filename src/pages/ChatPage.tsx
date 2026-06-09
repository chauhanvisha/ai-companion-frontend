import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  streamChat, summarizeSession, getChatHistory, saveChatHistory,
  clearChatHistory, saveProfile, getProfile, Message,
} from '../lib/api'
import { ArrowLeft, Send, RotateCcw, Pencil, User, CheckCircle, Star, Zap, TrendingUp, ArrowRight, Download } from 'lucide-react'

const SCENARIOS: Record<string, { emoji: string; title: string; color: string }> = {
  interview: { emoji: '🎯', title: 'Interview Prep',  color: '#1C88FC' },
  inbox:     { emoji: '📥', title: 'Inbox Reset',    color: '#8b5cf6' },
  email:     { emoji: '✉️',  title: 'Email Writing',  color: '#10b981' },
}

export default function ChatPage() {
  const { scenario = 'interview' } = useParams<{ scenario: string }>()
  const meta     = SCENARIOS[scenario] || { emoji: '💬', title: scenario, color: '#1C88FC' }
  const navigate = useNavigate()

  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [nudgeLimit, setNudgeLimit] = useState(2)
  const [loading,   setLoading]   = useState(true)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  // Debrief modal
  const [debriefState,   setDebriefState]   = useState<null | 'loading' | 'ready'>(null)
  const [debriefBullets, setDebriefBullets] = useState<string[]>([])
  const [debriefAction,  setDebriefAction]  = useState('')
  const [debriefNext,    setDebriefNext]    = useState<'back' | 'new'>('back')

  // Profile sidebar
  const [sidebarOpen,       setSidebarOpen]       = useState(false)
  const [profileField,      setProfileField]      = useState('')
  const [profileTargetRole, setProfileTargetRole] = useState('')
  const [profileSchool,     setProfileSchool]     = useState('')
  const [profileSaved,      setProfileSaved]      = useState(false)
  const [profileSaving,     setProfileSaving]     = useState(false)

  useEffect(() => {
    getProfile().then((p) => {
      if (p) {
        setProfileField(p.field || '')
        setProfileTargetRole(p.target_role || '')
        setProfileSchool(p.school || '')
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    getChatHistory(scenario).then(history => {
      const clean = history.filter(m => !m.content.startsWith('Error:'))
      if (clean.length === 0) {
        setMessages([])
        setLoading(false)
        sendOpener()
      } else {
        setMessages(clean)
        setLoading(false)
      }
    }).catch(() => {
      setLoading(false)
      sendOpener()
    })
  }, [scenario])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function scheduleSave(msgs: Message[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveChatHistory(scenario, msgs).catch(() => {})
    }, 1000)
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

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px'
    }
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    sendMessage(newMessages)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function parseDebrief(summary: string) {
    const lines = summary.split('\n').map(l => l.trim()).filter(Boolean)
    const bullets: string[] = []
    let action = ''
    for (const line of lines) {
      if (line.startsWith('NEXT:')) {
        action = line.replace('NEXT:', '').trim()
      } else if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        bullets.push(line.replace(/^[•\-*]\s*/, '').trim())
      }
    }
    return { bullets, action }
  }

  async function triggerDebrief(afterAction: 'back' | 'new') {
    if (messages.length < 4) {
      if (afterAction === 'back') navigate('/dashboard')
      else {
        await clearChatHistory(scenario).catch(() => {})
        setMessages([])
        setTimeout(() => sendOpener(), 100)
      }
      return
    }
    setDebriefNext(afterAction)
    setDebriefState('loading')
    try {
      const result = await summarizeSession(messages, scenario)
      if (result?.summary) {
        const { bullets, action } = parseDebrief(result.summary)
        setDebriefBullets(bullets)
        setDebriefAction(action)
        setDebriefState('ready')
      } else {
        // summary failed — navigate away silently
        dismissDebrief()
      }
    } catch {
      dismissDebrief()
    }
  }

  async function dismissDebrief() {
    setDebriefState(null)
    if (debriefNext === 'back') {
      navigate('/dashboard')
    } else {
      await clearChatHistory(scenario).catch(() => {})
      setMessages([])
      setTimeout(() => sendOpener(), 100)
    }
  }

  function handleBack() { triggerDebrief('back') }

  function handleNewConversation() { triggerDebrief('new') }

  function handleDownloadTranscript() {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const lines: string[] = [
      `HighView AI Coach — Session Transcript`,
      `Scenario: ${meta.title}`,
      `Date: ${date}`,
      `${'─'.repeat(50)}`,
      '',
    ]
    for (const msg of messages) {
      if (msg.content.startsWith('Error:') || msg.content.startsWith('[The student')) continue
      const speaker = msg.role === 'user' ? 'You' : 'Coach'
      lines.push(`${speaker}:`)
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

  async function handleSaveProfile() {
    setProfileSaving(true)
    try {
      await saveProfile(profileField, profileTargetRole, profileSchool)
      setProfileSaved(true)
      // Auto-restart session with updated profile after a brief "Saved!" moment
      setTimeout(async () => {
        setProfileSaved(false)
        await clearChatHistory(scenario).catch(() => {})
        setMessages([])
        sendOpener()
      }, 1200)
    } catch {
      // ignore
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'linear-gradient(160deg, #deeeff 0%, #f0f6ff 45%, #eef2ff 100%)' }}>

      {/* ===== DEBRIEF MODAL ===== */}
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
            </div>
          )}

          {debriefState === 'ready' && (
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full"
                 style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                     style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
                              boxShadow: `0 8px 24px ${meta.color}40` }}>
                  🎓
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">Session Complete!</h2>
                  <p className="text-sm text-slate-500">{meta.title} · here's what happened</p>
                </div>
              </div>

              {/* Bullets */}
              {debriefBullets.length > 0 && (
                <div className="space-y-3 mb-6">
                  {debriefBullets.map((bullet, i) => {
                    const icons = [
                      <TrendingUp key={0} className="w-4 h-4 shrink-0" style={{ color: meta.color }} />,
                      <Zap key={1} className="w-4 h-4 shrink-0 text-amber-500" />,
                      <Star key={2} className="w-4 h-4 shrink-0 text-emerald-500" />,
                    ]
                    const labels = ['Worked on', 'To improve', 'Did well']
                    const colors = [
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

              {/* Action item */}
              {debriefAction && (
                <div className="rounded-2xl p-4 mb-6 border border-blue-200"
                     style={{ background: `${meta.color}08` }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1.5"
                     style={{ color: meta.color }}>Before next time</p>
                  <p className="text-sm text-slate-700 leading-relaxed font-medium">{debriefAction}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={dismissDebrief}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all"
                  style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                           boxShadow: `0 4px 20px ${meta.color}40` }}
                >
                  {debriefNext === 'back' ? 'Back to Dashboard' : 'Start New Session'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={dismissDebrief}
                  className="px-5 py-3.5 rounded-2xl text-sm font-semibold text-slate-400
                    hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 bg-white/80 backdrop-blur-md border-b border-blue-100/80 z-50"
              style={{ boxShadow: '0 2px 16px rgba(28,136,252,0.07)' }}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500
              hover:text-primary hover:bg-blue-50 transition-all shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <img src="/highview-logo.png" alt="HighView" className="h-6 w-auto hidden sm:block" />

          {/* Mobile profile toggle */}
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="sm:hidden shrink-0 p-2 rounded-xl hover:bg-blue-50 transition-all"
            aria-label="Toggle profile"
          >
            <User className="w-4 h-4 text-slate-500" />
          </button>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xl">{meta.emoji}</span>
            <h1 className="font-bold text-slate-800 truncate">{meta.title}</h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <label className="text-xs text-slate-400 font-medium whitespace-nowrap">Nudges:</label>
              <select
                value={nudgeLimit}
                onChange={e => setNudgeLimit(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white
                  text-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              >
                {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              onClick={handleDownloadTranscript}
              disabled={messages.length === 0}
              title="Download transcript"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                text-slate-500 hover:text-primary hover:bg-blue-50 transition-all disabled:opacity-30"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Save</span>
            </button>
            <button
              onClick={handleNewConversation}
              disabled={streaming}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold
                text-slate-500 hover:text-primary hover:bg-blue-50 transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">New</span>
            </button>
          </div>
        </div>
      </header>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 min-h-0 max-w-5xl w-full mx-auto">

        {/* Sidebar */}
        <>
          {sidebarOpen && (
            <div
              className="sm:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            className={`
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              sm:translate-x-0
              fixed sm:static top-16 left-0 bottom-0
              z-40 sm:z-auto
              w-60 shrink-0
              flex flex-col
              px-4 py-5 gap-4
              overflow-y-auto
              transition-transform duration-200 ease-in-out
            `}
            style={{
              background: 'white',
              borderRight: '1px solid rgba(28,136,252,0.08)',
              boxShadow: 'sm:none, 4px 0 24px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg icon-box-blue flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Your Profile</h2>
            </div>

            <div className="flex flex-col gap-3 flex-1">
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

            <button
              onClick={handleSaveProfile}
              disabled={profileSaving}
              className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
                ${profileSaved
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/30'
                }`}
            >
              {profileSaved && <CheckCircle className="w-4 h-4" />}
              {profileSaved ? 'Saved!' : profileSaving ? 'Saving…' : 'Save'}
            </button>
          </aside>
        </>

        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">

          {/* Messages */}
          <main className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:0ms]"
                        style={{ background: meta.color, opacity: 0.5 }} />
                  <span className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:150ms]"
                        style={{ background: meta.color, opacity: 0.5 }} />
                  <span className="w-2.5 h-2.5 rounded-full animate-bounce [animation-delay:300ms]"
                        style={{ background: meta.color, opacity: 0.5 }} />
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div
                      className="w-9 h-9 rounded-2xl flex items-center justify-center text-base shrink-0 mb-0.5"
                      style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                               boxShadow: `0 4px 12px ${meta.color}40` }}
                    >
                      🎓
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-sm'
                        : 'bg-white text-slate-700 rounded-bl-sm'
                    }`}
                    style={msg.role === 'user'
                      ? { background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)`,
                          boxShadow: `0 4px 16px ${meta.color}35` }
                      : { boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid rgba(28,136,252,0.06)' }
                    }
                  >
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
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming || loading}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white
                  transition-all disabled:opacity-40 shrink-0"
                style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
                         boxShadow: `0 4px 16px ${meta.color}40` }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
