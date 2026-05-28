import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
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
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('student_model')
      .eq('username', username)
      .single()

    const existingModel: StudentModel = (profileData?.student_model as StudentModel) || {}

    const conversation = messages
      .filter((m: any) => !m.content.startsWith('[The student') && !m.content.startsWith('Error:'))
      .map((m: any) => `${m.role === 'user' ? 'STUDENT' : 'COACH'}: ${m.content}`)
      .join('\n\n')

    const extractionRes = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 512,
      system:     'You extract structured observations from coaching conversations. Return only valid JSON.',
      messages:   [{ role: 'user', content: buildExtractionPrompt(existingModel, conversation, scenario) }],
    })

    const rawExtraction = (extractionRes.content[0] as any).text.trim()
    let extracted: Partial<StudentModel> = {}
    try {
      const clean = rawExtraction.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      extracted = JSON.parse(clean)
    } catch { /* silently skip bad extraction */ }

    const updatedModel = mergeStudentModel(existingModel, extracted)
    await supabase.from('user_profiles').upsert({ username, student_model: updatedModel })

    // ── 3. Save skill score snapshot (for history graph) ──────────────────────
    if (updatedModel.skill_scores && Object.keys(updatedModel.skill_scores).length > 0) {
      await supabase.from('skill_score_snapshots')
        .insert({ username, scenario, scores: updatedModel.skill_scores })
        .then(() => {})
        .catch(() => {}) // non-critical
    }

    // ── 4. Generate embedding for semantic memory (pgvector) ─────────────────
    // Only runs if OPENAI_API_KEY is configured — silently skipped otherwise
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const embeddingRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: summary,
        })
        const embedding = embeddingRes.data[0].embedding
        await supabase.from('coaching_embeddings').insert({
          username,
          scenario,
          content:   summary,
          embedding: JSON.stringify(embedding),
        })
      } catch { /* embedding is non-critical — skip silently */ }
    }

    return res.json({ ok: true, summary, studentModel: updatedModel })

  } catch (e: any) {
    return res.json({ ok: false, reason: e.message })
  }
}
