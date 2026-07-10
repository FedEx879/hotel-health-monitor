// Auth token = SHA-256(username:password). Stored in the hhm_auth cookie and
// recomputed from env creds to verify. Uses Web Crypto so it works in the
// Edge middleware runtime and in Node route handlers alike.
export async function authToken(username: string, password: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${username}:${password}`)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const AUTH_COOKIE = 'hhm_auth';
