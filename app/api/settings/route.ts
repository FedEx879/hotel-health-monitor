import { NextResponse } from 'next/server';
import { errMessage } from '@/app/lib/errors';
import { loadSettings, saveSettings } from '@/app/lib/db';
import type { SettingsPayload } from '@/app/lib/types';

export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const settings: SettingsPayload = await request.json();
    await saveSettings(settings);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 });
  }
}
