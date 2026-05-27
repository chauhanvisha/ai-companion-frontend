import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../../_lib/db'
import { getUserFromRequest } from '../../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const scenario = req.query.scenario as string
  const client = db()

  if (req.method === 'GET') {
    const result = await client.from('chat_histories')
      .select('messages')
      .eq('username', username)
      .eq('scenario', scenario)
    return res.json({ messages: result.data?.[0]?.messages || [] })
  }

  if (req.method === 'POST') {
    const { messages } = req.body || {}
    const { error } = await client.from('chat_histories').upsert({
      username, scenario, messages, updated_at: new Date().toISOString()
    })
    if (error) return res.status(500).json({ detail: error.message })
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    await client.from('chat_histories').delete().eq('username', username).eq('scenario', scenario)
    return res.json({ ok: true })
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
