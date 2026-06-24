import type { VercelRequest, VercelResponse } from '@vercel/node'
import OpenAI from 'openai'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'
import { SESSION_SUMMARY_PROMPT, buildExtractionPrompt, mergeStudentModel, StudentModel, SCENARIO_SKILLS, SkillEvidence } from '../_lib/prompts'
import { createMessage, getProvider } from '../_lib/ai'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const MIN_MESSAGES_TO_SUMMARIZE = parseInt(process.env.MIN_MESSAGES_TO_SUMMARIZE || '4', 10)
  const { messages, scenario } = req.body || {}
  if (!messages || messages.length < MIN_MESSAGES_TO_SUMMARIZE) return res.json({ ok: false, reason: 'not enough messages' })

  const supabase = db()

  // Model config — override via env to swap models without code changes
  const SUMMARY_MODEL         = process.env.ANTHROPIC_CHAT_MODEL      || 'claude-haiku-4-5'
  const EXTRACTION_MODEL      = process.env.ANTHROPIC_EXTRACT_MODEL   || 'claude-haiku-4-5'
  const EMBEDDING_MODEL       = process.env.OPENAI_EMBEDDING_MODEL    || 'text-embedding-3-small'
  const SUMMARY_MAX_TOKENS    = parseInt(process.env.SUMMARY_MAX_TOKENS    || '512',  10)
  const EXTRACTION_MAX_TOKENS = parseInt(process.env.EXTRACTION_MAX_TOKENS || '512',  10)
  const EVIDENCE_MAX_TOKENS   = parseInt(process.env.EVIDENCE_MAX_TOKENS   || '400',  10)

  console.log(`[summarize] provider=${getProvider()} model=${SUMMARY_MODEL}`)

  try {
    // ── 1. Generate 3-bullet session summary ──────────────────────────────────
    const summary = await createMessage({
      model:      SUMMARY_MODEL,
      maxTokens:  SUMMARY_MAX_TOKENS,
      system:     'You are a concise note-taker summarizing a coaching session.',
      messages:   [...messages, { role: 'user', content: SESSION_SUMMARY_PROMPT }],
    })

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

    const rawExtraction = await createMessage({
      model:     EXTRACTION_MODEL,
      maxTokens: EXTRACTION_MAX_TOKENS,
      system:    'You extract structured observations from coaching conversations. Return only valid JSON.',
      messages:  [{ role: 'user', content: buildExtractionPrompt(existingModel, conversation, scenario) }],
    })
    let extracted: any = {}
    try {
      const clean = rawExtraction.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
      extracted = JSON.parse(clean)
    } catch { /* silently skip bad extraction */ }

    const updatedModel = mergeStudentModel(existingModel, extracted)

    // ── 2b. GUARANTEED evidence step (runs AFTER merge) ───────────────────────
    // Generate a "why" for the skills CURRENTLY in the model for THIS scenario —
    // not just newly-scored ones. This means evidence is backfilled even when the
    // extraction returns "nothing new" (e.g. re-analysing an existing conversation).
    const currentSkillKeys = (SCENARIO_SKILLS[scenario] || []).map(s => s.key)
    const skillsToExplain = Object.entries(updatedModel.skill_scores || {})
      .filter(([k]) => currentSkillKeys.length === 0 || currentSkillKeys.includes(k))
    if (skillsToExplain.length > 0) {
      try {
        const skillList = skillsToExplain.map(([k]) => k).join(', ')
        const rawEv = await createMessage({
          model:     EXTRACTION_MODEL,
          maxTokens: EVIDENCE_MAX_TOKENS,
          system:    'You explain skill assessments. Return ONLY valid JSON, no markdown.',
          messages: [{
            role: 'user',
            content:
              `Here is a coaching conversation:\n\n${conversation}\n\n` +
              `For EACH of these skills: ${skillList}\n` +
              `write ONE specific sentence (max 18 words) explaining what the student did in this ` +
              `conversation that reflects that skill. Reference concrete moments. Return a JSON object ` +
              `mapping each skill key to its sentence. Example: {"storytelling":"Used clear STAR structure but rushed the result."}`,
          }],
        })
        const cleanEv = rawEv.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
        const whyMap  = JSON.parse(cleanEv) as Record<string, string>

        const today    = new Date().toISOString().slice(0, 10)
        const evidence = { ...(updatedModel.skill_evidence || {}) } as Record<string, SkillEvidence[]>
        for (const [skill, score] of skillsToExplain) {
          const why = whyMap[skill]
          if (typeof why === 'string' && why.trim()) {
            const prev = evidence[skill] || []
            evidence[skill] = [...prev, { date: today, note: why.trim(), score }].slice(-6)
          }
        }
        if (Object.keys(evidence).length > 0) updatedModel.skill_evidence = evidence
      } catch (e: any) {
        console.error('[summarize] evidence step failed:', e.message)
        // Non-critical — scores still save without evidence
      }
    }

    await supabase.from('user_profiles').upsert({ username, student_model: updatedModel })

    // ── 3. Save skill score snapshot (for history graph) ──────────────────────
    if (updatedModel.skill_scores && Object.keys(updatedModel.skill_scores).length > 0) {
      try {
        await supabase.from('skill_score_snapshots')
          .insert({ username, scenario, scores: updatedModel.skill_scores })
      } catch { /* non-critical */ }
    }

    // ── 4. Generate embedding for semantic memory (pgvector) ─────────────────
    // Only runs if OPENAI_API_KEY is configured — silently skipped otherwise
    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const embeddingRes = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
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
