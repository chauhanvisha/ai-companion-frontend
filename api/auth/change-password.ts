import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { db } from '../_lib/db'
import { getUserFromRequest } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })

  let username: string
  try { username = await getUserFromRequest(req as any) }
  catch { return res.status(401).json({ detail: 'Unauthorized' }) }

  const { currentPassword, newPassword } = req.body || {}
  if (!currentPassword || !newPassword) return res.status(400).json({ detail: 'Both current and new password required' })
  if (newPassword.length < 6) return res.status(400).json({ detail: 'New password must be at least 6 characters' })

  const client = db()
  const result = await client.from('users').select('password_hash').eq('username', username)
  if (!result.data?.length) return res.status(404).json({ detail: 'User not found' })

  const currentHash = createHash('sha256').update(currentPassword).digest('hex')
  if (result.data[0].password_hash !== currentHash) return res.status(401).json({ detail: 'Current password is incorrect' })

  const newHash = createHash('sha256').update(newPassword).digest('hex')
  await client.from('users').update({ password_hash: newHash }).eq('username', username)

  return res.json({ ok: true })
}
