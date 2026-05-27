import Anthropic from '@anthropic-ai/sdk'
import { verifyToken } from '../_lib/auth'
import { buildSystemPrompt } from '../_lib/prompts'
import { db } from '../_lib/db'

export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ detail: 'Method not allowed' }), { status: 405 })
  }

  // Auth
  let username: string
  try {
    const auth = req.headers.get('authorization') || ''
    const token = auth.replace('Bearer ', '').trim()
    username = await verifyToken(token)
  } catch {
    return new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 })
  }

  const { messages, scenario, nudge_limit = 2 } = await req.json()

  // Load profile + session notes
  const client = db()
  const [profileRes, notesRes] = await Promise.all([
    client.table('user_profiles').select('field,target_role,school').eq('username', username),
    client.table('session_notes').select('scenario,notes,created_at').eq('username', username).order('created_at', { ascending: false }).limit(3),
  ])

  const profile = profileRes.data?.[0] || null
  const sessionNotes = notesRes.data || []

  const systemPrompt = buildSystemPrompt({ nudgeLimit: nudge_limit, scenario, profile, sessionNotes })

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-opus-4-7',
          max_tokens: 2048,
          system: systemPrompt,
          messages,
        })

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const data = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (e: any) {
        const errData = `data: ${JSON.stringify({ error: e.message })}\n\n`
        controller.enqueue(encoder.encode(errData))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
