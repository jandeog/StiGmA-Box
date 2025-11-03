import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'sbx_session';
export const SIGNUP_EMAIL_COOKIE = 'sbx_signup_email';

const raw = process.env.AUTH_SECRET || '';
if (raw.length < 32) {
  console.warn('⚠️ AUTH_SECRET is short. Use at least 32 bytes (see docs).');
}
const secret = new TextEncoder().encode(raw);

export type SessionPayload = {
  aid: string;
  email: string;
  role?: 'coach' | 'athlete';
};

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(secret);
}

export async function verifySession(token?: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { clockTolerance: '5s' });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
