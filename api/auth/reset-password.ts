import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { db } from '../_lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  const { token, newPassword } = req.body || {}
  if (!token || !newPassword) return res.status(400).json({ detail: 'Token and new password required' })
  if (newPassword.length < 6) return res.status(400).json({ detail: 'Password must be at least 6 characters' })

  const client = db()
  const result = await client
    .from('password_reset_tokens')
    .select('username,expires_at,used')
    .eq('token', token)
    .single()

  if (!result.data) return res.status(400).json({ detail: 'Invalid or expired reset link' })
  if (result.data.used) return res.status(400).json({ detail: 'This reset link has already been used' })
  if (new Date(result.data.expires_at) < new Date()) return res.status(400).json({ detail: 'Reset link has expired. Please request a new one.' })

  const newHash = createHash('sha256').update(newPassword).digest('hex')

  // Update password + mark token as used
  await Promise.all([
    client.from('users').update({ password_hash: newHash }).eq('username', result.data.username),
    client.from('password_reset_tokens').update({ used: true }).eq('token', token),
  ])

  return res.json({ ok: true })
}
