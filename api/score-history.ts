import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db'
import { getUserFromRequest } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const client = db()
  const result = await client
    .from('skill_score_snapshots')
    .select('scenario,scores,created_at')
    .eq('username', username)
    .order('created_at', { ascending: true })
    .limit(30)

  return res.json({ snapshots: result.data || [] })
}
