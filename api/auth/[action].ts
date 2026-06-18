import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, randomBytes } from 'crypto'
import { Resend } from 'resend'
import { db } from '../_lib/db'
import { createToken, getUserFromRequest } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const action = req.query.action as string
  const client = db()

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const { username, password } = req.body || {}
    if (!username?.trim() || !password)
      return res.status(400).json({ detail: 'Username and password required' })

    const u      = username.trim()
    const hash   = createHash('sha256').update(password).digest('hex')
    const result = await client.from('users').select('password_hash').eq('username', u)

    if (result.error) return res.status(500).json({ detail: 'Database error. Please try again.' })
    if (!result.data?.length) return res.status(401).json({ detail: 'Username not found.' })
    if (result.data[0].password_hash !== hash) return res.status(401).json({ detail: 'Incorrect password.' })

    const token = await createToken(u)
    return res.json({ token, username: u })
  }

  // ── REGISTER ───────────────────────────────────────────────────────────────
  if (action === 'register') {
    const { username, password, email } = req.body || {}
    if (!username?.trim() || !password)
      return res.status(400).json({ detail: 'Username and password required' })

    const u        = username.trim()
    const e        = email?.trim().toLowerCase() || null
    const hash     = createHash('sha256').update(password).digest('hex')
    const existing = await client.from('users').select('username').eq('username', u)

    if (existing.error) return res.status(500).json({ detail: 'Database error. Please try again.' })
    if (existing.data?.length) return res.status(400).json({ detail: 'Username already taken.' })

    const { error } = await client.from('users').insert({ username: u, password_hash: hash, email: e })
    if (error) return res.status(500).json({ detail: error.message })

    const token = await createToken(u)
    return res.json({ token, username: u })
  }

  // ── CHANGE PASSWORD ────────────────────────────────────────────────────────
  if (action === 'change-password') {
    let username: string
    try { username = await getUserFromRequest(req as any) }
    catch { return res.status(401).json({ detail: 'Unauthorized' }) }

    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword)
      return res.status(400).json({ detail: 'Both current and new password required' })
    if (newPassword.length < 6)
      return res.status(400).json({ detail: 'New password must be at least 6 characters' })

    try {
      const result = await client.from('users').select('password_hash').eq('username', username)
      if (!result.data?.length) return res.status(404).json({ detail: 'User not found' })

      const currentHash = createHash('sha256').update(currentPassword).digest('hex')
      if (result.data[0].password_hash !== currentHash)
        return res.status(401).json({ detail: 'Current password is incorrect' })

      const newHash = createHash('sha256').update(newPassword).digest('hex')
      const { error: updateError } = await client.from('users').update({ password_hash: newHash }).eq('username', username)
      if (updateError) return res.status(500).json({ detail: 'Failed to update password. Please try again.' })

      return res.json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ detail: 'Something went wrong. Please try again.' })
    }
  }

  // ── FORGOT PASSWORD ────────────────────────────────────────────────────────
  if (action === 'forgot-password') {
    const { email } = req.body || {}
    if (!email?.trim()) return res.status(400).json({ detail: 'Email is required' })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return res.status(500).json({ detail: 'Email service not configured. Please contact support.' })

    try {
      const result = await client.from('users').select('username,email').eq('email', email.trim().toLowerCase())
      if (!result.data?.length) return res.json({ ok: true }) // Security: always succeed

      const username  = result.data[0].username
      const token     = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      const { error: tokenError } = await client.from('password_reset_tokens').insert({ username, token, expires_at: expiresAt })
      if (tokenError) return res.status(500).json({ detail: 'Failed to generate reset link. Please try again.' })

      const appUrl   = process.env.APP_URL || 'https://ai-companion-frontend-iota.vercel.app'
      const resetUrl = `${appUrl}/reset-password?token=${token}`
      const resend   = new Resend(resendKey)

      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'HighView AI Coach <onboarding@resend.dev>',
        to: email.trim(),
        subject: 'Reset your HighView password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#0f172a;margin-bottom:8px;">Reset your password</h2>
            <p style="color:#64748b;margin-bottom:24px;">
              Hi ${username}, click below to reset your HighView AI Coach password.
            </p>
            <a href="${resetUrl}" style="display:inline-block;background:#1C88FC;color:white;
              padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;">
              Reset Password
            </a>
            <p style="color:#94a3b8;font-size:13px;margin-top:24px;">
              This link expires in 1 hour. If you didn't request this, ignore this email.
            </p>
          </div>
        `,
      })

      return res.json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ detail: 'Something went wrong. Please try again.' })
    }
  }

  // ── RESET PASSWORD ─────────────────────────────────────────────────────────
  if (action === 'reset-password') {
    const { token, newPassword } = req.body || {}
    if (!token || !newPassword)
      return res.status(400).json({ detail: 'Token and new password required' })
    if (newPassword.length < 6)
      return res.status(400).json({ detail: 'Password must be at least 6 characters' })

    try {
      const result = await client
        .from('password_reset_tokens')
        .select('username,expires_at,used')
        .eq('token', token)
        .single()

      if (!result.data || result.error)
        return res.status(400).json({ detail: 'Invalid or expired reset link. Please request a new one.' })
      if (result.data.used)
        return res.status(400).json({ detail: 'This reset link has already been used.' })
      if (new Date(result.data.expires_at) < new Date())
        return res.status(400).json({ detail: 'Reset link has expired. Please request a new one.' })

      const newHash = createHash('sha256').update(newPassword).digest('hex')
      const [pwUpdate] = await Promise.all([
        client.from('users').update({ password_hash: newHash }).eq('username', result.data.username),
        client.from('password_reset_tokens').update({ used: true }).eq('token', token),
      ])

      if (pwUpdate.error) return res.status(500).json({ detail: 'Failed to update password. Please try again.' })
      return res.json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ detail: 'Something went wrong. Please try again.' })
    }
  }

  return res.status(404).json({ detail: 'Unknown action' })
}
