import { SignJWT, jwtVerify } from 'jose'

const jwtSecretRaw = process.env.JWT_SECRET || 'highview-dev-secret-change-in-production'
const secret = new TextEncoder().encode(jwtSecretRaw)

/** How long issued JWTs remain valid. Override with JWT_EXPIRY env var (e.g. "7d", "24h"). */
const JWT_EXPIRY = (process.env.JWT_EXPIRY || '30d') as `${number}${'d' | 'h' | 'm' | 's'}`

export async function createToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret)
}

export async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret)
  if (!payload.sub) throw new Error('Invalid token')
  return payload.sub
}

export async function getUserFromRequest(req: any): Promise<string> {
  // Support both Web API Request (req.headers.get) and
  // Node.js IncomingMessage / VercelRequest (req.headers['authorization'])
  let auth = ''
  if (typeof req.headers?.get === 'function') {
    auth = req.headers.get('authorization') || ''
  } else {
    auth = (req.headers?.['authorization'] || req.headers?.['Authorization'] || '') as string
  }
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('No token')
  return verifyToken(token)
}
