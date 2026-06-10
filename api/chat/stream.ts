import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'
import { buildSystemPrompt, SCENARIO_NAMES, SCENARIO_SKILLS, RelevantMoment } from '../_lib/prompts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const { messages, scenario, nudge_limit = 2 } = req.body || {}

  const supabase = db()
  const [profileRes, notesRes, checkinRes] = await Promise.all([
    supabase.from('user_profiles').select('field,target_role,school,student_model,weekly_checkin_enabled').eq('username', username),
    supabase.from('session_notes').select('scenario,notes,created_at').eq('username', username).order('created_at', { ascending: false }).limit(10),
    supabase.from('weekly_checkins').select('followed_through,confidence_rating,focus_this_week,created_at').eq('username', username).order('created_at', { ascending: false }).limit(1),
  ])

  const profileRow   = profileRes.data?.[0] || null
  const profile      = profileRow ? { field: profileRow.field, target_role: profileRow.target_role, school: profileRow.school } : null
  const studentModel = profileRow?.student_model || null

  // Scenario isolation: only inject notes from the SAME scenario.
  // (An interview-prep recap should never bleed into an inbox-reset session.)
  const allNotes     = notesRes.data || []
  const sessionNotes = allNotes.filter(n => n.scenario === scenario).slice(0, 3)

  // Check-in: only inject if enabled and done within last 7 days
  const checkinEnabled = profileRow?.weekly_checkin_enabled === true
  const latestCheckin  = checkinRes.data?.[0] || null
  const checkinAgeDays = latestCheckin
    ? (Date.now() - new Date(latestCheckin.created_at).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity
  const checkin = checkinEnabled && checkinAgeDays < 7 ? latestCheckin : null

  // ── Semantic memory: retrieve most relevant past moments via pgvector ────
  let relevantMoments: RelevantMoment[] = []
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      // Build a query that captures the focus of today's session.
      // Only consider skills that belong to the CURRENT scenario (no cross-scenario bleed).
      const currentSkillKeys = (SCENARIO_SKILLS[scenario] || []).map(s => s.key)
      const scopedScores = studentModel?.skill_scores
        ? Object.entries(studentModel.skill_scores).filter(([k]) => currentSkillKeys.includes(k))
        : []
      const lowestSkill = scopedScores.length
        ? scopedScores.sort(([, a], [, b]) => a - b)[0]?.[0]
        : null
      const queryParts = [
        SCENARIO_NAMES[scenario] || scenario,
        lowestSkill   ? `focus area: ${lowestSkill}`            : '',
        checkin?.focus_this_week ? `student goal: ${checkin.focus_this_week}` : '',
      ].filter(Boolean)
      const queryText = queryParts.join(', ')

      const embRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: queryText,
      })
      const queryEmbedding = embRes.data[0].embedding

      // Similarity search via Supabase RPC
      const { data: moments } = await supabase.rpc('match_coaching_moments', {
        query_embedding: queryEmbedding,
        match_threshold: 0.4,
        match_count:     3,
        filter_username: username,
      })
      // Only keep moments from the same scenario — no cross-scenario bleed
      relevantMoments = ((moments || []) as RelevantMoment[]).filter(m => m.scenario === scenario)
    } catch { /* fail silently — semantic memory is non-critical */ }
  }

  const systemPrompt = buildSystemPrompt({ nudgeLimit: nudge_limit, scenario, profile, sessionNotes, studentModel, checkin, relevantMoments })

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
