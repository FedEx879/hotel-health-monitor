import { NextResponse } from 'next/server';
import { authToken, AUTH_COOKIE } from '@/app/lib/auth';

export async function POST(request: Request) {
  const { username, password } = await request.json().catch(() => ({}));

  const validUser = process.env.APP_USERNAME ?? '';
  const validPass = process.env.APP_PASSWORD ?? '';
  if (!validUser || !validPass) {
    return NextResponse.json({ error: 'Login not configured on the server.' }, { status: 500 });
  }

  if (String(username) !== validUser || String(password) !== validPass) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });
  }

  const token = await authToken(validUser, validPass);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
