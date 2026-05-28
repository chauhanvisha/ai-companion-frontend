import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'
import { SESSION_SUMMARY_PROMPT, buildExtractionPrompt, mergeStudentModel, StudentModel } from '../_lib/prompts'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const { messages, scenario } = req.body || {}
  if (!messages || messages.length < 4) return res.json({ ok: false, reason: 'not enough messages' })

  const client   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const supabase = db()

  try {
    // ── 1. Generate 3-bullet session summary ──────────────────────────────────
    const summaryRes = await client.messages.create({
      model:      'claude-opus-4-7',
      max_tokens: 512,
      system:     'You are a concise note-taker summarizing a coaching session.',
      messages:   [...messages, { role: 'user', content: SESSION_SUMMARY_PROMPT }],
    })
    const summary = (summaryRes.content[0] as any).text

    // Save session note
    await supabase.from('session_notes').insert({ username, scenario, notes: summary })

    // ── 2. Memory extraction — update the living student model ────────────────
    // Load existing student_model
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('student_model')
      .eq('username', username)
      .single()

    const existingModel: StudentModel = (profileData?.student_model as StudentModel) || {}

    // Build a readable conversation string for extraction
    const conversation = messages
      .filter((m: any) => !m.content.startsWith('[The student') && !m.content.startsWith('Error:'))
      .map((m: any) => `${m.role === 'user' ? 'STUDENT' : 'COACH'}: ${m.content}`)
      .join('\n\n')

    // Call Claude for structured extraction (cheaper/faster model)
    const extractionRes = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 512,
      system:     'You extract structured observations from coaching conversations. Return only valid JSON.',
      messages:   [{ role: 'user', content: buildExtractionPrompt(existingModel, conversation, scenario) }],
    })

    const rawExtraction = (extractionRes.content[0] as any).text.trim()

    // Parse the JSON safely
    let extracted: Partial<StudentModel> = {}
    try {
      // Strip markdown code blocks if Claude added them
      const clean = rawExtraction.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      extracted = JSON.parse(clean)
    } catch {
      // Extraction parse failed — not critical, skip silently
    }

    // Merge and save
    const updatedModel = mergeStudentModel(existingModel, extracted)
    await supabase
      .from('user_profiles')
      .upsert({ username, student_model: updatedModel })

    return res.json({ ok: true, summary, studentModel: updatedModel })

  } catch (e: any) {
    return res.json({ ok: false, reason: e.message })
  }
}
