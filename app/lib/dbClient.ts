// Client-side helpers — call our own API routes (which run server-side with
// the Supabase service role key) instead of talking to Supabase directly.
// This keeps the database reachable only through routes gated by the app's
// login middleware, with no privileged key ever shipped to the browser.
import { errMessage } from './errors';
import type { OutreachRecord, RawOrderRow, SettingsPayload } from './types';

/**
 * Fetch one of our API routes and return its parsed JSON.
 *
 * Failures have to stay readable: a route can answer with JSON that carries an
 * `error`, but a gateway timeout or a crash answers with HTML, so parsing is
 * attempted and then reported rather than thrown raw.
 */
async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    // Offline, DNS failure, request blocked — never reached the server.
    throw new Error(`Network request to ${url} failed: ${errMessage(e)}`);
  }

  const raw = await res.text().catch(() => '');
  let parsed: unknown = undefined;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Not JSON — an HTML error page or a proxy message.
    }
  }

  if (!res.ok) {
    const fromBody =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? errMessage((parsed as { error: unknown }).error)
        : raw.slice(0, 200).trim();
    const detail = fromBody || res.statusText || 'no details';
    throw new Error(`${url} returned ${res.status}: ${detail}`);
  }

  if (parsed === undefined) {
    throw new Error(
      `${url} returned a response that was not JSON: ${raw.slice(0, 200).trim() || '(empty)'}`
    );
  }

  return parsed as T;
}

export async function fetchAllOrders(): Promise<RawOrderRow[]> {
  const data = await apiRequest<{ rows?: RawOrderRow[] }>('/api/orders');
  return data.rows ?? [];
}

export async function upsertOrders(
  rows: RawOrderRow[]
): Promise<{ inserted: number; total: number }> {
  return apiRequest<{ inserted: number; total: number }>('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export async function loadSettings(): Promise<SettingsPayload | null> {
  const data = await apiRequest<{ settings?: SettingsPayload | null }>('/api/settings');
  return data.settings ?? null;
}

export async function saveSettings(settings: SettingsPayload): Promise<void> {
  await apiRequest('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function loadOutreach(): Promise<Record<string, OutreachRecord>> {
  const data = await apiRequest<{ outreach?: Record<string, OutreachRecord> }>(
    '/api/first-orders'
  );
  return data.outreach ?? {};
}

/** Update one user's First Orders state; returns the refreshed full map. */
export async function saveOutreach(
  userEmail: string,
  property: string,
  patch: { archived?: boolean; markEmailSent?: boolean }
): Promise<Record<string, OutreachRecord>> {
  const data = await apiRequest<{ outreach?: Record<string, OutreachRecord> }>(
    '/api/first-orders',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, property, ...patch }),
    }
  );
  return data.outreach ?? {};
}
