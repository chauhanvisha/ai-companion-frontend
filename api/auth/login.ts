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
  const result = await client.from('users').select('password_hash').eq('username', u)
  if (!result.data?.length) return res.status(401).json({ detail: 'Username not found.' })
  if (result.data[0].password_hash !== hash) return res.status(401).json({ detail: 'Incorrect password.' })

  const token = await createToken(u)
  return res.json({ token, username: u })
}
