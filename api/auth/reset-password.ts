import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { db } from '../_lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const { token, newPassword } = req.body || {}
  if (!token || !newPassword) return res.status(400).json({ detail: 'Token and new password required' })
  if (newPassword.length < 6) return res.status(400).json({ detail: 'Password must be at least 6 characters' })

  try {
    const client = db()
    const result = await client
      .from('password_reset_tokens')
      .select('username,expires_at,used')
      .eq('token', token)
      .single()

    if (!result.data || result.error) return res.status(400).json({ detail: 'Invalid or expired reset link. Please request a new one.' })
    if (result.data.used) return res.status(400).json({ detail: 'This reset link has already been used. Please request a new one.' })
    if (new Date(result.data.expires_at) < new Date()) return res.status(400).json({ detail: 'Reset link has expired. Please request a new one.' })

    const newHash = createHash('sha256').update(newPassword).digest('hex')

    // Update password + mark token as used
    const [pwUpdate, tokenUpdate] = await Promise.all([
      client.from('users').update({ password_hash: newHash }).eq('username', result.data.username),
      client.from('password_reset_tokens').update({ used: true }).eq('token', token),
    ])

    if (pwUpdate.error) {
      console.error('[reset-password] password update error:', pwUpdate.error.message)
      return res.status(500).json({ detail: 'Failed to update password. Please try again.' })
    }
    if (tokenUpdate.error) {
      console.error('[reset-password] token invalidation error:', tokenUpdate.error.message)
      // Password was updated — don't fail the request, just log
    }

    return res.json({ ok: true })
  } catch (e: any) {
    console.error('[reset-password] error:', e.message)
    return res.status(500).json({ detail: 'Something went wrong. Please try again.' })
  }
}
