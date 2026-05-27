import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db'
import { getUserFromRequest } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const client = db()
  const result = await client.table('session_notes')
    .select('scenario,notes,created_at')
    .eq('username', username)
    .order('created_at', { ascending: false })
    .limit(3)

  return res.json({ notes: result.data || [] })
}
