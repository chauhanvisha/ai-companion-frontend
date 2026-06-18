const BASE = import.meta.env.VITE_API_URL || ''

function token() {
  return localStorage.getItem('token') || ''
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }
}

/** If any API call comes back 401, clear session and redirect to login */
function handle401(res: Response) {
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    window.location.href = '/'
  }
}

export async function register(username: string, password: string, email?: string) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Registration failed')
  return data as { token: string; username: string }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await fetch(`${BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Failed to change password')
  return data
}

export async function forgotPassword(email: string) {
  const res = await fetch(`${BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Failed to send reset email')
  return data
}

export async function resetPassword(token: string, newPassword: string) {
  const res = await fetch(`${BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Failed to reset password')
  return data
}

export async function login(username: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Login failed')
  return data as { token: string; username: string }
}

export async function getProfile() {
  const res = await fetch(`${BASE}/api/profile`, { headers: authHeaders() })
  handle401(res)
  if (!res.ok) return null
  return res.json().catch(() => null)
}

export async function saveProfile(field: string, target_role: string, school: string) {
  const res = await fetch(`${BASE}/api/profile`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ field, target_role, school }),
  })
  return res.json()
}

export async function getSessionNotes() {
  const res = await fetch(`${BASE}/api/session-notes`, { headers: authHeaders() })
  handle401(res)
  if (!res.ok) return [] as SessionNote[]
  const data = await res.json().catch(() => ({}))
  return (data.notes || []) as SessionNote[]
}

export async function getChatHistory(scenario: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/api/chat/history/${scenario}`, { headers: authHeaders() })
  const data = await res.json()
  return data.messages || []
}

export async function saveChatHistory(scenario: string, messages: Message[]) {
  await fetch(`${BASE}/api/chat/history/${scenario}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ messages }),
  })
}

export async function clearChatHistory(scenario: string) {
  await fetch(`${BASE}/api/chat/history/${scenario}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
}

export async function summarizeSession(messages: Message[], scenario: string) {
  const res = await fetch(`${BASE}/api/chat/summarize`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ messages, scenario }),
  })
  handle401(res)
  if (!res.ok) return null
  return res.json().catch(() => null)
}

export function streamChat(
  messages: Message[],
  scenario: string,
  nudge_limit: number,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  fetch(`${BASE}/api/chat/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ messages, scenario, nudge_limit }),
  }).then(async (res) => {
    if (!res.ok) {
      handle401(res)
      const data = await res.json()
      onError(data.detail || 'Stream failed')
      return
    }
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { onDone(); return }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) { onError(parsed.error); return }
            if (parsed.text)  onChunk(parsed.text)
          } catch {}
        }
      }
    }
    onDone()
  }).catch((e) => onError(e.message))
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  name: string
  scenario: string
  created_at: string
  updated_at: string
}

export async function getChatSessions(scenario: string): Promise<ChatSession[]> {
  const res = await fetch(`${BASE}/api/chat/sessions?scenario=${scenario}`, { headers: authHeaders() })
  handle401(res)
  const data = await res.json()
  return data.sessions || []
}

export async function createChatSession(scenario: string, name: string): Promise<ChatSession> {
  const res = await fetch(`${BASE}/api/chat/sessions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ scenario, name }),
  })
  handle401(res)
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Failed to create session')
  return data as ChatSession
}

export async function getChatSessionMessages(id: string): Promise<Message[]> {
  const res = await fetch(`${BASE}/api/chat/session/${id}`, { headers: authHeaders() })
  handle401(res)
  if (!res.ok) return []
  const data = await res.json().catch(() => ({}))
  return data.messages || []
}

export async function updateChatSession(id: string, messages: Message[]): Promise<void> {
  await fetch(`${BASE}/api/chat/session/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ messages }),
  })
}

export async function deleteChatSession(id: string): Promise<void> {
  await fetch(`${BASE}/api/chat/session/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
}

export interface SessionNote {
  scenario:   string
  notes:      string
  created_at: string
}

export interface SkillEvidence {
  date:  string
  note:  string
  score: number
}

export interface StudentModel {
  communication_style?:      string
  confidence_level?:         string
  recurring_strengths?:      string[]
  recurring_weaknesses?:     string[]
  what_resonates?:           string[]
  trajectory?:               string
  preferred_feedback_style?: string
  skill_scores?:             Record<string, number>
  skill_evidence?:           Record<string, SkillEvidence[]>
  sessions_total?:           number
  last_updated?:             string
}

export interface Profile {
  field?:                   string
  target_role?:             string
  school?:                  string
  student_model?:           StudentModel
  weekly_checkin_enabled?:  boolean
}

export interface CheckinData {
  followed_through?:   string   // 'yes' | 'partially' | 'no'
  confidence_rating?:  number   // 1–5
  focus_this_week?:    string
  created_at?:         string
}

export interface CheckinStatus {
  enabled: boolean
  isDue:   boolean
  latest:  CheckinData | null
}

export async function getCheckinStatus(): Promise<CheckinStatus> {
  const res = await fetch(`${BASE}/api/checkin`, { headers: authHeaders() })
  handle401(res)
  if (!res.ok) return { enabled: false, isDue: false, latest: null }
  return res.json().catch(() => ({ enabled: false, isDue: false, latest: null }))
}

export async function saveCheckin(data: Omit<CheckinData, 'created_at'>) {
  const res = await fetch(`${BASE}/api/checkin`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function saveWeeklyCheckinToggle(enabled: boolean) {
  const res = await fetch(`${BASE}/api/profile`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ weekly_checkin_enabled: enabled }),
  })
  return res.json()
}

export interface ScoreSnapshot {
  scenario:   string
  scores:     Record<string, number>
  created_at: string
}

export async function getScoreHistory(): Promise<ScoreSnapshot[]> {
  const res = await fetch(`${BASE}/api/score-history`, { headers: authHeaders() })
  handle401(res)
  if (!res.ok) return []
  const data = await res.json().catch(() => ({}))
  return data.snapshots || []
}

/** Parse the • bullet + NEXT: line format produced by the session summary */
export function parseSessionNotes(raw: string): { bullets: string[]; action: string } {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const bullets: string[] = []
  let action = ''
  for (const line of lines) {
    if (line.startsWith('NEXT:')) {
      action = line.replace(/^NEXT:\s*/i, '').trim()
    } else if (line.startsWith('•') || line.startsWith('-')) {
      bullets.push(line.replace(/^[•\-]\s*/, '').trim())
    }
  }
  return { bullets, action }
}
