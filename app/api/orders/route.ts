import { NextResponse } from 'next/server';
import { fetchAllOrders, upsertOrders } from '@/app/lib/db';
import type { RawOrderRow } from '@/app/lib/types';

export const maxDuration = 60;

export async function GET() {
  try {
    const rows = await fetchAllOrders();
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: RawOrderRow[] = body?.rows ?? [];
    const result = await upsertOrders(rows);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
