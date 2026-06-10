import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const client = db()

  // GET /api/chat/sessions?scenario=interview — list sessions
  if (req.method === 'GET') {
    const scenario = req.query.scenario as string
    if (!scenario) return res.status(400).json({ detail: 'scenario is required' })

    const result = await client
      .from('chat_sessions')
      .select('id,name,scenario,created_at,updated_at')
      .eq('username', username)
      .eq('scenario', scenario)
      .order('updated_at', { ascending: false })
      .limit(50)

    return res.json({ sessions: result.data || [] })
  }

  // POST /api/chat/sessions — create a new session
  if (req.method === 'POST') {
    const { scenario, name } = req.body || {}
    if (!scenario || !name) return res.status(400).json({ detail: 'scenario and name are required' })

    const { data, error } = await client
      .from('chat_sessions')
      .insert({ username, scenario, name, messages: [] })
      .select('id,name,scenario,created_at,updated_at')
      .single()

    if (error) return res.status(500).json({ detail: error.message })
    return res.json(data)
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
