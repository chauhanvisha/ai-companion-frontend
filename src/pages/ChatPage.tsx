import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { streamChat, summarizeSession, getChatHistory, saveChatHistory, clearChatHistory, saveProfile, getProfile, Message } from '../lib/api'
import { Button } from '../components/ui/button'
import { ArrowLeft, Send, RotateCcw, Pencil, User } from 'lucide-react'

const SCENARIOS: Record<string, { icon: string; title: string }> = {
  interview: { icon: '🎯', title: 'Interview Prep' },
  inbox:     { icon: '📥', title: 'Inbox Reset' },
  email:     { icon: '✉️',  title: 'Email Writing' },
}

export default function ChatPage() {
  const { scenario = 'interview' } = useParams<{ scenario: string }>()
  const meta = SCENARIOS[scenario] || { icon: '💬', title: scenario }
  const navigate = useNavigate()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [nudgeLimit, setNudgeLimit] = useState(2)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Profile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileField, setProfileField] = useState('')
  const [profileTargetRole, setProfileTargetRole] = useState('')
  const [profileSchool, setProfileSchool] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  // Load profile on mount
  useEffect(() => {
    getProfile().then((p) => {
      if (p) {
        setProfileField(p.field || '')
        setProfileTargetRole(p.target_role || '')
        setProfileSchool(p.school || '')
      }
    }).catch(() => {})
  }, [])

  // Load history from Supabase on mount
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

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Debounced save to Supabase after every message change
  function scheduleSave(msgs: Message[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveChatHistory(scenario, msgs).catch(() => {})
    }, 1000)
  }

  function sendOpener() {
    sendMessage([{
      role: 'user',
      content: `[The student just selected the ${meta.title} scenario. Start directly with your opening for that coaching flow.]`
    }], true)
  }

  function sendMessage(msgs: Message[], isOpener = false) {
    setStreaming(true)
    let accumulated = ''

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    streamChat(
      msgs,
      scenario,
      nudgeLimit,
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
          setMessages(prev => {
            scheduleSave(prev)
            return prev
          })
        }
      },
      (err) => {
        setStreaming(false)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `Error: ${err}` }
          return updated
        })
      }
    )
  }

  function handleSend() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
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

  async function handleBack() {
    if (messages.length >= 4) {
      await summarizeSession(messages, scenario).catch(() => {})
    }
    navigate('/dashboard')
  }

  async function handleNewConversation() {
    if (messages.length >= 4) {
      await summarizeSession(messages, scenario).catch(() => {})
    }
    await clearChatHistory(scenario).catch(() => {})
    setMessages([])
    setTimeout(() => sendOpener(), 100)
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-2 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <img src="/highview-logo.png" alt="HighView" className="h-6 w-auto hidden sm:block" />

          {/* Mobile profile toggle — hidden on sm+ */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(prev => !prev)}
            className="sm:hidden shrink-0 p-2"
            aria-label="Toggle profile"
          >
            <User className="w-4 h-4" />
          </Button>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xl">{meta.icon}</span>
            <h1 className="font-semibold text-foreground truncate">{meta.title}</h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Nudges:</label>
              <select
                value={nudgeLimit}
                onChange={e => setNudgeLimit(Number(e.target.value))}
                className="text-xs border border-input rounded px-2 py-1 bg-background focus:ring-2 focus:ring-ring"
              >
                {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <Button variant="ghost" size="sm" onClick={handleNewConversation} disabled={streaming} className="gap-1">
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">New</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Body: sidebar + chat */}
      <div className="flex flex-1 max-w-5xl w-full mx-auto">

        {/* Profile Sidebar — always visible on sm+, overlay on mobile when open */}
        <>
          {/* Mobile overlay backdrop */}
          {sidebarOpen && (
            <div
              className="sm:hidden fixed inset-0 z-30 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside
            className={`
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              sm:translate-x-0
              fixed sm:static
              top-16 left-0 bottom-0
              z-40 sm:z-auto
              w-60 shrink-0
              bg-white border-r border-border
              transition-transform duration-200 ease-in-out
              flex flex-col
              px-4 py-5
              overflow-y-auto
            `}
          >
            <div className="flex items-center gap-2 mb-5">
              <Pencil className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Your Profile</h2>
            </div>

            <div className="flex flex-col gap-4 flex-1">
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
              className="mt-5 w-full"
              variant={profileSaved ? 'outline' : 'default'}
            >
              {profileSaved ? 'Saved ✓' : 'Save'}
            </Button>
          </aside>
        </>

        {/* Chat column */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Messages */}
          <main className="flex-1 px-4 py-6 space-y-6">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm mr-3 mt-1 shrink-0">
                      🎓
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.content || (streaming && i === messages.length - 1 ? (
                      <span className="flex gap-1 py-1">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
                    ) : '')}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </main>

          {/* Input */}
          <div className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-border">
            <div className="px-4 py-4">
              <div className="flex gap-3 items-end">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  disabled={streaming || loading}
                  className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm
                    placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                    disabled:opacity-50 max-h-32 overflow-y-auto"
                  style={{ minHeight: '44px' }}
                  onInput={e => {
                    const el = e.currentTarget
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming || loading}
                  size="default"
                  className="rounded-xl h-11 w-11 p-0 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
