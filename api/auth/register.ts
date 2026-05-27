import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash } from 'crypto'
import { db } from '../_lib/db'
import { createToken } from '../_lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' })
  const { username, password } = req.body || {}
  if (!username?.trim() || !password) return res.status(400).json({ detail: 'Username and password required' })

  const u = username.trim()
  const hash = createHash('sha256').update(password).digest('hex')

  const client = db()
  const existing = await client.table('users').select('username').eq('username', u)
  if (existing.data?.length) return res.status(400).json({ detail: 'Username already taken.' })

  const { error } = await client.table('users').insert({ username: u, password_hash: hash })
  if (error) return res.status(500).json({ detail: error.message })

  const token = await createToken(u)
  return res.json({ token, username: u })
}
