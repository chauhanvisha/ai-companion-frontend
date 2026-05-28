import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_lib/db'
import { getUserFromRequest } from './_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const client = db()

  // ── GET — return latest check-in + whether one is due ────────────────────
  if (req.method === 'GET') {
    const [profileRes, checkinRes] = await Promise.all([
      client.from('user_profiles').select('weekly_checkin_enabled').eq('username', username).single(),
      client.from('weekly_checkins').select('*').eq('username', username)
        .order('created_at', { ascending: false }).limit(1),
    ])

    const enabled = profileRes.data?.weekly_checkin_enabled === true
    const latest  = checkinRes.data?.[0] || null

    // Due if: enabled + (never done before OR last one was 7+ days ago)
    const daysSinceLast = latest
      ? (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity
    const isDue = enabled && daysSinceLast >= 7

    return res.json({ enabled, isDue, latest })
  }

  // ── POST — save a new check-in ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { followed_through, confidence_rating, focus_this_week } = req.body || {}

    const { error } = await client.from('weekly_checkins').insert({
      username,
      followed_through:  followed_through  || null,
      confidence_rating: confidence_rating  || null,
      focus_this_week:   focus_this_week    || null,
    })

    if (error) return res.status(500).json({ detail: error.message })
    return res.json({ ok: true })
  }

  return res.status(405).json({ detail: 'Method not allowed' })
}
