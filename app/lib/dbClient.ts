// Client-side helpers — call our own API routes (which run server-side with
// the Supabase service role key) instead of talking to Supabase directly.
// This keeps the database reachable only through routes gated by the app's
// login middleware, with no privileged key ever shipped to the browser.
import type { RawOrderRow, SettingsPayload } from './types';

export async function fetchAllOrders(): Promise<RawOrderRow[]> {
  const res = await fetch('/api/orders');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.rows ?? [];
}

export async function upsertOrders(
  rows: RawOrderRow[]
): Promise<{ inserted: number; total: number }> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function loadSettings(): Promise<SettingsPayload | null> {
  const res = await fetch('/api/settings');
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.settings ?? null;
}

export async function saveSettings(settings: SettingsPayload): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
}
