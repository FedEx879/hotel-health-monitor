// Login = email (@inn-flow.com only) + one-time code sent by Slack DM.
// The session cookie holds "<email>|<expiry>|<signature>", signed with
// AUTH_SECRET (HMAC-SHA256). Uses Web Crypto so it works in the Edge
// middleware runtime and in Node route handlers alike.

export const AUTH_COOKIE = 'hhm_session';
export const ALLOWED_DOMAIN = 'inn-flow.com';
export const SESSION_DAYS = 7;

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function secret(): string {
  const s = process.env.AUTH_SECRET ?? '';
  if (s.length < 32) throw new Error('AUTH_SECRET is missing or shorter than 32 characters.');
  return s;
}

export async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

// Constant-time comparison so timing doesn't leak how much of a value matched.
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+$/.test(email)) return null;
  if (email.split('@')[1] !== ALLOWED_DOMAIN) return null;
  return email;
}

export async function createSession(email: string): Promise<{ value: string; maxAge: number }> {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expires = Math.floor(Date.now() / 1000) + maxAge;
  const payload = `${email}|${expires}`;
  return { value: `${payload}|${await hmac(`session:${payload}`)}`, maxAge };
}

// Returns the signed-in email, or null if the cookie is missing, forged or expired.
export async function readSession(cookie: string | undefined): Promise<string | null> {
  if (!cookie) return null;
  const parts = cookie.split('|');
  if (parts.length !== 3) return null;
  const [email, expires, sig] = parts;
  if (!normalizeEmail(email)) return null;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000) return null;
  try {
    return safeEqual(sig, await hmac(`session:${email}|${expires}`)) ? email : null;
  } catch {
    return null;
  }
}

export async function hashCode(email: string, code: string): Promise<string> {
  return hmac(`code:${email}:${code}`);
}
