import { NextResponse } from 'next/server';
import { normalizeEmail, hashCode, ALLOWED_DOMAIN } from '@/app/lib/auth';
import { findSlackUser, sendCodeDM } from '@/app/lib/slack';
import { supabaseServer } from '@/app/lib/supabaseServer';

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_WAIT_MS = 60 * 1000;

// Same answer whether or not the person exists, so the page can't be used to
// discover who has a Slack account.
const GENERIC = {
  ok: true,
  message: 'If that email belongs to an active Inn-Flow Slack member, a code is on its way in Slack.',
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: `Use your @${ALLOWED_DOMAIN} email.` }, { status: 400 });
  }

  try {
    const { data: existing } = await supabaseServer
      .from('login_codes')
      .select('last_sent_at')
      .eq('email', email)
      .maybeSingle();
    if (existing && Date.now() - new Date(existing.last_sent_at).getTime() < RESEND_WAIT_MS) {
      return NextResponse.json({ error: 'Please wait a minute before asking for another code.' }, { status: 429 });
    }

    const slackUserId = await findSlackUser(email);
    if (!slackUserId) return NextResponse.json(GENERIC);

    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const code = String(n).padStart(6, '0');
    const now = Date.now();

    const { error } = await supabaseServer.from('login_codes').upsert(
      {
        email,
        code_hash: await hashCode(email, code),
        expires_at: new Date(now + CODE_TTL_MS).toISOString(),
        attempts: 0,
        last_sent_at: new Date(now).toISOString(),
      },
      { onConflict: 'email' }
    );
    if (error) throw new Error(`Saving login code failed: ${error.message}`);

    await sendCodeDM(slackUserId, code);
    return NextResponse.json(GENERIC);
  } catch (err) {
    console.error('[login/request-code]', err);
    return NextResponse.json({ error: 'Could not send the code. Please try again later.' }, { status: 500 });
  }
}
