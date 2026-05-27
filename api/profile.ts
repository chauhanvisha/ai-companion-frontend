import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db'
import { getUserFromRequest } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const client = db()

  if (req.method === 'GET') {
    const result = await client.table('user_profiles').select('field,target_role,school').eq('username', username)
    return res.json(result.data?.[0] || {})
  }

  if (req.method === 'POST') {
    const { field = '', target_role = '', school = '' } = req.body || {}
    const { error } = await client.table('user_profiles').upsert({ username, field, target_role, school })
    if (error) return res.status(500).json({ detail: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
