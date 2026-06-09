import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomBytes } from 'crypto'
import { Resend } from 'resend'
import { db } from '../_lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const { email } = req.body || {}
  if (!email?.trim()) return res.status(400).json({ detail: 'Email is required' })

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.error('[forgot-password] RESEND_API_KEY not set')
    return res.status(500).json({ detail: 'Email service not configured. Please contact support.' })
  }

  try {
    const client = db()
    const result = await client.from('users').select('username,email').eq('email', email.trim().toLowerCase())

    // Always return success even if email not found (security best practice)
    if (!result.data?.length) return res.json({ ok: true })

    const username = result.data[0].username
    const token    = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

    // Store token
    const { error: tokenError } = await client.from('password_reset_tokens').insert({ username, token, expires_at: expiresAt })
    if (tokenError) {
      console.error('[forgot-password] token insert error:', tokenError.message)
      return res.status(500).json({ detail: 'Failed to generate reset link. Please try again.' })
    }

    // Send email
    const resetUrl = `${process.env.APP_URL || 'https://ai-companion-frontend-iota.vercel.app'}/reset-password?token=${token}`
    const resend   = new Resend(resendKey)

    await resend.emails.send({
      from: 'HighView AI Coach <onboarding@resend.dev>',
      to: email.trim(),
      subject: 'Reset your HighView password',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <img src="https://ai-companion-frontend-iota.vercel.app/highview-logo.png" height="32" style="margin-bottom: 24px;" />
          <h2 style="color: #0f172a; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #64748b; margin-bottom: 24px;">
            Hi ${username}, we received a request to reset your HighView AI Coach password.
            Click the button below to choose a new password.
          </p>
          <a href="${resetUrl}"
             style="display: inline-block; background: #1C88FC; color: white; padding: 14px 28px;
                    border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Reset Password
          </a>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">HighView · AI Coach</p>
        </div>
      `,
    })

    return res.json({ ok: true })
  } catch (e: any) {
    console.error('[forgot-password] error:', e.message)
    return res.status(500).json({ detail: 'Something went wrong. Please try again.' })
  }
}
