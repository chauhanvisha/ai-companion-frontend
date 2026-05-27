const BASE = import.meta.env.VITE_API_URL || ''

function token() {
  return localStorage.getItem('token') || ''
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }
}

export async function register(username: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || 'Registration failed')
  return data as { token: string; username: string }
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
  return res.json()
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
  const data = await res.json()
  return data.notes as SessionNote[]
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
  return res.json()
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
            const { text } = JSON.parse(payload)
            if (text) onChunk(text)
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

export interface SessionNote {
  scenario: string
  notes: string
  created_at: string
}

export interface Profile {
  field?: string
  target_role?: string
  school?: string
}
