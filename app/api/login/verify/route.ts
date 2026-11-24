import { NextResponse } from 'next/server';
import { normalizeEmail, hashCode, safeEqual, createSession, AUTH_COOKIE } from '@/app/lib/auth';
import { supabaseServer } from '@/app/lib/supabaseServer';

const MAX_ATTEMPTS = 5;
const INVALID = 'That code is wrong or has expired. Request a new one.';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const code = String(body.code ?? '').replace(/\D/g, '');
  if (!email || code.length !== 6) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  try {
    const { data: row } = await supabaseServer
      .from('login_codes')
      .select('code_hash, expires_at, attempts')
      .eq('email', email)
      .maybeSingle();

    if (!row || row.attempts >= MAX_ATTEMPTS || new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    // Count the attempt before checking it. Matching on the old attempts value
    // means two simultaneous guesses can't both slip through on one count.
    const { data: bumped } = await supabaseServer
      .from('login_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('email', email)
      .eq('attempts', row.attempts)
      .select('email');
    if (!bumped?.length) return NextResponse.json({ error: INVALID }, { status: 401 });

    if (!safeEqual(row.code_hash, await hashCode(email, code))) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    // Single use.
    await supabaseServer.from('login_codes').delete().eq('email', email);

    const session = await createSession(email);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, session.value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: session.maxAge,
    });
    return res;
  } catch (err) {
    console.error('[login/verify]', err);
    return NextResponse.json({ error: 'Could not sign in. Please try again later.' }, { status: 500 });
  }
}
