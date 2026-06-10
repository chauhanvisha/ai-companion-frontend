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
    let extracted: any = {}
    try {
      const clean = rawExtraction.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      extracted = JSON.parse(clean)
    } catch { /* silently skip bad extraction */ }

    // ── 2b. GUARANTEED evidence step ──────────────────────────────────────────
    // The big extraction is unreliable at nesting a "why" per skill, so we run a
    // dedicated focused call that ONLY produces the reason for each scored skill.
    // Normalise whatever score format the extraction returned into { skill: score }.
    const scoredSkills: Record<string, number> = {}
    if (extracted.skill_assessment && typeof extracted.skill_assessment === 'object') {
      for (const [k, v] of Object.entries<any>(extracted.skill_assessment)) {
        if (v && typeof v.score === 'number') scoredSkills[k] = v.score
      }
    } else if (extracted.skill_scores && typeof extracted.skill_scores === 'object') {
      for (const [k, v] of Object.entries<any>(extracted.skill_scores)) {
        if (typeof v === 'number') scoredSkills[k] = v
      }
    }

    if (Object.keys(scoredSkills).length > 0) {
      try {
        const skillList = Object.keys(scoredSkills).join(', ')
        const evidenceRes = await client.messages.create({
          model:      'claude-haiku-4-5',
          max_tokens: 400,
          system:     'You explain skill assessments. Return ONLY valid JSON, no markdown.',
          messages: [{
            role: 'user',
            content:
              `Here is a coaching conversation:\n\n${conversation}\n\n` +
              `For EACH of these skills: ${skillList}\n` +
              `write ONE specific sentence (max 18 words) explaining what the student did THIS session ` +
              `that justifies their score. Reference concrete moments. Return a JSON object mapping ` +
              `each skill key to its sentence. Example: {"storytelling":"Used clear STAR structure but rushed the result."}`,
          }],
        })
        const rawEv = (evidenceRes.content[0] as any).text.trim()
        const cleanEv = rawEv.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
        const whyMap = JSON.parse(cleanEv) as Record<string, string>

        // Rebuild skill_assessment in the coupled format so the merge creates evidence
        const assessment: Record<string, { score: number; why?: string }> = {}
        for (const [skill, score] of Object.entries(scoredSkills)) {
          assessment[skill] = { score, why: typeof whyMap[skill] === 'string' ? whyMap[skill] : undefined }
        }
        extracted.skill_assessment = assessment
        delete extracted.skill_scores  // avoid double-processing in merge
      } catch (e: any) {
        console.error('[summarize] evidence step failed:', e.message)
        // Fall back to whatever the original extraction had — scores still save
      }
    }

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
