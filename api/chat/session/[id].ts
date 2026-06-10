import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../../_lib/db'
import { getUserFromRequest } from '../../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const id     = req.query.id as string
  const client = db()

  // GET — load messages for a session
  if (req.method === 'GET') {
    const result = await client
      .from('chat_sessions')
      .select('id,name,scenario,messages,created_at')
      .eq('id', id)
      .eq('username', username)
      .single()

    if (!result.data) return res.status(404).json({ detail: 'Session not found' })
    return res.json(result.data)
  }

  // PUT — update messages (and optionally name)
  if (req.method === 'PUT') {
    const { messages, name } = req.body || {}
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (messages !== undefined) updates.messages = messages
    if (name     !== undefined) updates.name     = name

    const { error } = await client
      .from('chat_sessions')
      .update(updates)
      .eq('id', id)
      .eq('username', username)

    if (error) return res.status(500).json({ detail: error.message })
    return res.json({ ok: true })
  }

  // DELETE — remove a session
  if (req.method === 'DELETE') {
    await client
      .from('chat_sessions')
      .delete()
      .eq('id', id)
      .eq('username', username)

    return res.json({ ok: true })
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
