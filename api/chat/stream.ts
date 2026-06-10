import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'
import { buildSystemPrompt } from '../_lib/prompts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const { messages, scenario, nudge_limit = 2 } = req.body || {}

  const supabase = db()

  // BLANK SLATE: each chat starts fresh. We do NOT inject the coach's autonomous
  // cross-session memory (student model, past session notes, semantic moments) —
  // that was deciding the student's path for them. We only use what the student
  // actively provides: their profile (static) and their opt-in weekly check-in.
  const [profileRes, checkinRes] = await Promise.all([
    supabase.from('user_profiles').select('field,target_role,school,weekly_checkin_enabled').eq('username', username),
    supabase.from('weekly_checkins').select('followed_through,confidence_rating,focus_this_week,created_at').eq('username', username).order('created_at', { ascending: false }).limit(1),
  ])

  const profileRow = profileRes.data?.[0] || null
  const profile    = profileRow ? { field: profileRow.field, target_role: profileRow.target_role, school: profileRow.school } : null

  // Check-in: only inject if enabled and done within last 7 days
  const checkinEnabled = profileRow?.weekly_checkin_enabled === true
  const latestCheckin  = checkinRes.data?.[0] || null
  const checkinAgeDays = latestCheckin
    ? (Date.now() - new Date(latestCheckin.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity
  const checkin = checkinEnabled && checkinAgeDays < 7 ? latestCheckin : null

  const systemPrompt = buildSystemPrompt({ nudgeLimit: nudge_limit, scenario, profile, checkin })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
  } catch (e: any) {
    console.error('[stream] Anthropic error:', e.message, e.status ?? '')
    res.write(`data: ${JSON.stringify({ error: e.message || 'Stream failed' })}\n\n`)
    res.write('data: [DONE]\n\n')
  } finally {
    res.end()
  }
}
