import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'
import { SESSION_SUMMARY_PROMPT } from '../_lib/prompts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const { messages, scenario } = req.body || {}
  if (!messages || messages.length < 4) return res.json({ ok: false, reason: 'not enough messages' })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      system: 'You are a concise note-taker summarizing a coaching session.',
      messages: [...messages, { role: 'user', content: SESSION_SUMMARY_PROMPT }],
    })
    const summary = (response.content[0] as any).text

    const supabase = db()
    await supabase.from('session_notes').insert({ username, scenario, notes: summary })

    return res.json({ ok: true, summary })
  } catch (e: any) {
    return res.json({ ok: false, reason: e.message })
  }
}
