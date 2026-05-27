import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me')

export async function createToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('72h')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret)
  if (!payload.sub) throw new Error('Invalid token')
  return payload.sub
}

export async function getUserFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) throw new Error('No token')
  return verifyToken(token)
}
