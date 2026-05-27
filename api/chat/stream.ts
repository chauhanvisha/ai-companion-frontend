import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'
import { buildSystemPrompt } from '../_lib/prompts'

export const config = { runtime: 'nodejs', maxDuration: 300 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const { messages, scenario, nudge_limit = 2 } = req.body || {}

  const client = db()
  const [profileRes, notesRes] = await Promise.all([
    client.from('user_profiles').select('field,target_role,school').eq('username', username),
    client.from('session_notes').select('scenario,notes,created_at').eq('username', username).order('created_at', { ascending: false }).limit(3),
  ])

  const profile = profileRes.data?.[0] || null
  const sessionNotes = notesRes.data || []
  const systemPrompt = buildSystemPrompt({ nudgeLimit: nudge_limit, scenario, profile, sessionNotes })

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
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
  } finally {
    res.end()
  }
}
