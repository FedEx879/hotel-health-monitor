import { isValidStatus } from './analysis';
import type { FirstOrder, OutreachRecord, RawOrderRow } from './types';

/** A user stays on the active list for four weeks after their first order. */
export const ACTIVE_WINDOW_DAYS = 28;

export const OUTREACH_SUBJECT = 'First order successfully processed!';

/** The outreach email body. [USER NAME] is replaced with the user's first name. */
export function outreachBody(userName: string): string {
  const firstName = (userName || '').trim().split(/\s+/)[0] || 'there';
  return [
    `Hi ${firstName}`,
    '',
    "I'm glad to see you placed your first order!",
    '',
    'How was that first experience? Did you find everything you wanted?',
    '',
    "I'd love to hear any feedback you may have.",
    '',
    'Best regards,',
  ].join('\n');
}

/** Compose URL that opens Outlook on the web with the message prefilled. */
export function outlookComposeUrl(to: string, userName: string): string {
  const params = new URLSearchParams({
    to,
    subject: OUTREACH_SUBJECT,
    body: outreachBody(userName),
  });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

export function key(userEmail: string, property: string): string {
  return `${userEmail}||${property}`;
}

/** Fall back to a readable name when the order carries no user_name. */
export function displayName(userName: string, userEmail: string): string {
  const n = (userName || '').trim();
  if (n) return n;
  const local = (userEmail || '').split('@')[0];
  if (!local) return '—';
  // "erica.s.ward" -> "Erica S Ward"; leave opaque handles alone.
  if (!/[._-]/.test(local)) return local;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function daysBetween(from: string, to: Date): number {
  const d = new Date(`${from}T00:00:00`);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((to.getTime() - d.getTime()) / 86400000);
}

export interface FirstOrdersResult {
  active: FirstOrder[];
  archived: FirstOrder[];
}

/**
 * Find each user's first order per property.
 *
 * A user appears on the active list until ACTIVE_WINDOW_DAYS have passed since
 * that first order, or until they are archived manually. Everyone else is in
 * the archive so their first-order date stays searchable.
 */
export function computeFirstOrders(
  rows: RawOrderRow[],
  outreach: Record<string, OutreachRecord> = {},
  today: Date = new Date()
): FirstOrdersResult {
  const firstByUser = new Map<string, RawOrderRow>();

  for (const r of rows) {
    if (!r.user_email || !r.order_date) continue;
    if (!isValidStatus(r.status)) continue;
    const k = key(r.user_email, r.property);
    const prev = firstByUser.get(k);
    // Earliest date wins; ties break on the lower order id so it is stable.
    if (
      !prev ||
      r.order_date < prev.order_date ||
      (r.order_date === prev.order_date && String(r.order_id) < String(prev.order_id))
    ) {
      firstByUser.set(k, r);
    }
  }

  const active: FirstOrder[] = [];
  const archived: FirstOrder[] = [];

  for (const [k, r] of firstByUser) {
    const rec = outreach[k];
    const daysSince = daysBetween(r.order_date, today);
    const agedOut = daysSince > ACTIVE_WINDOW_DAYS;
    const isArchived = rec?.archived === true || agedOut;

    const entry: FirstOrder = {
      property: r.property,
      company: r.company,
      userEmail: r.user_email,
      userName: displayName(r.user_name, r.user_email),
      firstDate: r.order_date,
      spend: r.spend,
      vendor: r.vendor,
      daysSince,
      archived: isArchived,
      archivedAt: rec?.archivedAt ?? null,
      emailSentAt: rec?.emailSentAt ?? null,
      agedOut: agedOut && rec?.archived !== true,
    };

    (isArchived ? archived : active).push(entry);
  }

  // Active: newest first order first — the freshest outreach opportunity.
  active.sort((a, b) => b.firstDate.localeCompare(a.firstDate));
  archived.sort((a, b) => b.firstDate.localeCompare(a.firstDate));

  return { active, archived };
}

/** Group entries by company, then by property, preserving each list's order. */
export function groupByCompanyHotel(
  entries: FirstOrder[]
): { company: string; hotels: { property: string; users: FirstOrder[] }[] }[] {
  const byCompany = new Map<string, Map<string, FirstOrder[]>>();

  for (const e of entries) {
    if (!byCompany.has(e.company)) byCompany.set(e.company, new Map());
    const hotels = byCompany.get(e.company)!;
    if (!hotels.has(e.property)) hotels.set(e.property, []);
    hotels.get(e.property)!.push(e);
  }

  return [...byCompany.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([company, hotels]) => ({
      company,
      hotels: [...hotels.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([property, users]) => ({ property, users })),
    }));
}
