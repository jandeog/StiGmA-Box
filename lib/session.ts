// lib/session.ts
import * as jose from 'jose';

export const SESSION_COOKIE = 'stigma_session';
export const SIGNUP_EMAIL_COOKIE = 'stigma_signup_email';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'dev_secret_change_me');
const alg = 'HS256';

export type SessionPayload = { aid: string; email: string; role: 'coach'|'athlete' };

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new jose.SignJWT(payload as any)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(secret);
}

// Works in both Node routes and Edge middleware
export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, secret, { algorithms: [alg] });
    const { aid, email, role } = payload as any;
    if (!aid || !email || !role) return null;
    return { aid, email, role };
  } catch {
    return null;
  }
}
