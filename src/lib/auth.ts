import crypto from 'crypto'
import { cookies } from 'next/headers'

const SECRET = process.env.SESSION_SECRET || 'construction-app-secret-secure-key-at-least-32-chars-long'

export interface UserSession {
  id: string
  username: string
  display_name: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'pending' | 'approved' | 'suspended'
}

/**
 * Sign a payload with HMAC SHA-256 (JWT-like structure)
 */
export function signToken(payload: UserSession): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${signature}`
}

/**
 * Verify signature and parse the token
 */
export function verifyToken(token: string): UserSession | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, signature] = parts
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(`${header}.${body}`)
      .digest('base64url')
    
    if (signature !== expectedSig) return null
    
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

/**
 * Server-side helper to fetch the current user session from cookies.
 * Await this in any Server Component or Server Action.
 */
export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value
    if (!token) return null
    return verifyToken(token)
  } catch (err) {
    console.error('Error reading session cookie:', err)
    return null
  }
}
