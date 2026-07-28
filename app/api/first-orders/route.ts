import { NextResponse } from 'next/server';
import { loadOutreach, saveOutreach } from '@/app/lib/db';

export async function GET() {
  try {
    const outreach = await loadOutreach();
    return NextResponse.json({ outreach });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userEmail = String(body?.userEmail ?? '');
    const property = String(body?.property ?? '');
    if (!userEmail || !property) {
      return NextResponse.json({ error: 'userEmail and property are required.' }, { status: 400 });
    }

    const patch: { archived?: boolean; emailSentAt?: string } = {};
    if (typeof body.archived === 'boolean') patch.archived = body.archived;
    // The server stamps the time so the log cannot be spoofed by the client.
    if (body.markEmailSent === true) patch.emailSentAt = new Date().toISOString();

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    await saveOutreach(userEmail, property, patch);
    const outreach = await loadOutreach();
    return NextResponse.json({ ok: true, outreach });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
