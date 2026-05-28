import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db'
import { getUserFromRequest } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const client = db()

  if (req.method === 'GET') {
    const result = await client
      .from('user_profiles')
      .select('field,target_role,school,student_model,weekly_checkin_enabled')
      .eq('username', username)
    return res.json(result.data?.[0] || {})
  }

  if (req.method === 'POST') {
    const { field = '', target_role = '', school = '', weekly_checkin_enabled } = req.body || {}
    // Build update object — only include weekly_checkin_enabled if explicitly passed
    const update: Record<string, any> = { username, field, target_role, school }
    if (typeof weekly_checkin_enabled === 'boolean') update.weekly_checkin_enabled = weekly_checkin_enabled
    const { error } = await client
      .from('user_profiles')
      .upsert(update, { onConflict: 'username' })
    if (error) return res.status(500).json({ detail: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
