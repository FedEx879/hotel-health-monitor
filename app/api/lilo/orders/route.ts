import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { RawOrderRow } from '@/app/lib/types';

export const maxDuration = 300; // allow long-running sync where the platform permits

const LILO_BASE = 'https://api.liloshop.io/product/orders';
const PAGE = 100;

/** Convert a Lilo order object into our RawOrderRow shape. */
function mapOrder(o: Record<string, unknown>): RawOrderRow | null {
  const id = o._id != null ? String(o._id) : '';
  if (!id) return null;

  const createdAt = typeof o.createdAt === 'number' ? o.createdAt : Number(o.createdAt);
  let order_date = '';
  if (createdAt && !isNaN(createdAt)) {
    const d = new Date(createdAt * 1000);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      order_date = `${y}-${mo}-${day}`;
    }
  }

  const hotel = (o.hotel as Record<string, unknown>) || {};
  const user = (o.user as Record<string, unknown>) || {};
  const spend =
    typeof o.totalPrice === 'number' ? o.totalPrice : parseFloat(String(o.totalPrice ?? '0')) || 0;

  return {
    order_id: id,
    property: String(o.hotelName || hotel.name || 'Unknown'),
    spend,
    order_date,
    company: String(o.managementGroupName || hotel.companyName || 'Unknown'),
    vendor: String(o.vendorName || ''),
    user_email: String(user.email || ''),
    status: String(o.status || ''),
    csm: '', // CSM is assigned manually in Settings
    go_live_date: String(hotel.goLiveDate || ''),
  };
}

/** Fetch the set of order_ids already stored in Supabase. */
async function fetchKnownOrderIds(): Promise<Set<string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ids = new Set<string>();
  if (!url || !key) return ids;

  const supabase = createClient(url, key);
  const SB_PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('order_id')
      .range(from, from + SB_PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data) if (row.order_id) ids.add(String(row.order_id));
    if (data.length < SB_PAGE) break;
    from += SB_PAGE;
  }
  return ids;
}

export async function GET(request: Request) {
  const token = process.env.LILO_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'LILO_API_TOKEN is not configured on the server.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  // full=1 pulls everything (used for the one-time backfill); default is incremental.
  const full = searchParams.get('full') === '1';
  // Safety cap on pages per request so we don't run forever. ~100 orders/page.
  const maxPages = Number(searchParams.get('maxPages')) || (full ? 200 : 12);
  // Only pull orders newer than this many days (default 90 = what the analysis needs).
  const sinceDays = Number(searchParams.get('sinceDays')) || 90;
  const cutoffSec = Math.floor(Date.now() / 1000) - sinceDays * 86400;

  const known = full ? new Set<string>() : await fetchKnownOrderIds();

  const rows: RawOrderRow[] = [];
  let skip = 0;
  let reachedKnown = false;

  try {
    for (let page = 0; page < maxPages; page++) {
      const url = `${LILO_BASE}?limit=${PAGE}&skip=${skip}&orderBy=id&order=desc&search=&excludeDemo=true`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-from-admin': 'true',
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return NextResponse.json(
          { error: `Lilo API returned ${res.status}: ${text.slice(0, 300)}` },
          { status: 502 }
        );
      }

      const data = await res.json();
      const orders: Record<string, unknown>[] = Array.isArray(data?.orders) ? data.orders : [];
      if (orders.length === 0) break;

      let newInPage = 0;
      let reachedCutoff = false;
      for (const o of orders) {
        // Orders come newest-first; once we pass the cutoff date we can stop.
        const createdAt =
          typeof o.createdAt === 'number' ? o.createdAt : Number(o.createdAt);
        if (createdAt && createdAt < cutoffSec) {
          reachedCutoff = true;
          break;
        }
        const id = o._id != null ? String(o._id) : '';
        if (!full && id && known.has(id)) continue; // already stored — skip
        const mapped = mapOrder(o);
        if (mapped) {
          rows.push(mapped);
          newInPage++;
        }
      }

      if (reachedCutoff) {
        reachedKnown = true; // nothing older matters — we're done
        break;
      }

      // Incremental: if a whole page had no new orders, we've caught up.
      if (!full && newInPage === 0) {
        reachedKnown = true;
        break;
      }

      if (orders.length < PAGE) break;
      skip += PAGE;
    }

    return NextResponse.json({
      rows,
      count: rows.length,
      caughtUp: reachedKnown,
      hitPageCap: !reachedKnown && rows.length > 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    return NextResponse.json({ error: `Could not reach Lilo: ${msg}` }, { status: 502 });
  }
}
