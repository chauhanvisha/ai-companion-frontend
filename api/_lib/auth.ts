import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me')

export async function createToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
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
