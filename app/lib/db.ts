import { supabaseServer as supabase } from './supabaseServer'
import { dbError } from './errors'
import type { OutreachRecord, RawOrderRow, SettingsPayload } from './types'

export async function upsertOrders(
  rows: RawOrderRow[]
): Promise<{ inserted: number; total: number }> {
  if (!rows.length) return { inserted: 0, total: 0 };

  const dbRows = rows
    .filter((r) => r.order_date)
    .map((r) => ({
      order_id: r.order_id || `${r.property}__${r.order_date}__${r.spend}__${r.vendor}__${r.user_email}`,
      property: r.property,
      spend: r.spend,
      order_date: r.order_date,
      company: r.company,
      vendor: r.vendor,
      user_email: r.user_email,
      user_name: r.user_name || '',
      status: r.status,
      csm: r.csm,
      go_live_date: r.go_live_date || null,
    }));

  const { data, error } = await supabase
    .from('orders')
    .upsert(dbRows, {
      onConflict: 'order_id',
      ignoreDuplicates: true,
    })
    .select();

  if (error) throw dbError('save orders', error);

  const inserted = data?.length ?? 0;
  return { inserted, total: dbRows.length };
}

const ORDER_COLS =
  'order_id, property, spend, order_date, company, vendor, user_email, user_name, status, csm, go_live_date';

function toRawOrderRow(row: Record<string, unknown>): RawOrderRow {
  return {
    order_id: (row.order_id as string) ?? '',
    property: (row.property as string) ?? '',
    spend: (row.spend as number) ?? 0,
    order_date: (row.order_date as string) ?? '',
    company: (row.company as string) ?? '',
    vendor: (row.vendor as string) ?? '',
    user_email: (row.user_email as string) ?? '',
    user_name: (row.user_name as string) ?? '',
    status: (row.status as string) ?? '',
    csm: (row.csm as string) ?? '',
    go_live_date: (row.go_live_date as string) ?? '',
  };
}

export async function fetchAllOrders(): Promise<RawOrderRow[]> {
  // Supabase caps a response at 1000 rows, so a full read is always paged.
  const PAGE = 1000;

  const { count, error: countError } = await supabase
    .from('orders')
    .select('order_id', { count: 'exact', head: true });
  if (countError) throw dbError('count orders', countError);

  const total = count ?? 0;
  if (total === 0) return [];

  // Fetch the pages concurrently rather than one after another: this runs
  // inside a serverless function with a hard time limit, and sequential
  // round-trips were the slowest part of loading the app.
  const pageCount = Math.ceil(total / PAGE);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      supabase
        .from('orders')
        .select(ORDER_COLS)
        // order_id is the tiebreaker: ordering by date alone leaves rows that
        // share a date in an arbitrary order, so concurrent page slices could
        // repeat or drop rows.
        .order('order_date', { ascending: true })
        .order('order_id', { ascending: true })
        .range(i * PAGE, i * PAGE + PAGE - 1)
    )
  );

  const allRows: RawOrderRow[] = [];
  for (const page of pages) {
    if (page.error) throw dbError('load orders', page.error);
    for (const row of page.data ?? []) allRows.push(toRawOrderRow(row));
  }

  return allRows;
}

export async function saveSettings(settings: SettingsPayload): Promise<void> {
  // Build property → company map from propertiesByCompany
  const propToCompany: Record<string, string> = {};
  if (settings.propertiesByCompany) {
    Object.entries(settings.propertiesByCompany).forEach(([company, props]) => {
      props.forEach((p) => {
        propToCompany[p] = company;
      });
    });
  }

  // company_settings
  if (settings.companyRows.length > 0) {
    const companyData = settings.companyRows.map((c) => ({
      company: c.name,
      enabled: c.enabled,
      reason: c.reason,
      go_live_date: settings.goLiveDates[`company:${c.name}`] || null,
      csm_owner: settings.csmOverrides[c.name] || null,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('company_settings')
      .upsert(companyData, { onConflict: 'company' });
    if (error) throw dbError('save company settings', error);
  }

  // property_settings — merge excludedProperties and foodProperties
  const allProps = new Set([
    ...Object.keys(settings.excludedProperties),
    ...Object.keys(settings.foodProperties),
  ]);

  if (allProps.size > 0) {
    const propertyData = [...allProps].map((prop) => ({
      property: prop,
      company: propToCompany[prop] ?? null,
      enabled: settings.excludedProperties[prop] !== false,
      go_live_date: settings.goLiveDates[`property:${prop}`] || null,
      food_analysis: settings.foodProperties[prop] ?? false,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('property_settings')
      .upsert(propertyData, { onConflict: 'property' });
    if (error) throw dbError('save property settings', error);
  }

  // vendor_settings
  if (settings.vendorRows.length > 0) {
    const vendorData = settings.vendorRows.map((v) => ({
      vendor: v.name,
      is_food: v.isFood,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase
      .from('vendor_settings')
      .upsert(vendorData, { onConflict: 'vendor' });
    if (error) throw dbError('save vendor settings', error);
  }
}

export async function loadSettings(): Promise<SettingsPayload | null> {
  const [companiesRes, propertiesRes, vendorsRes] = await Promise.all([
    supabase.from('company_settings').select('*'),
    supabase.from('property_settings').select('*'),
    supabase.from('vendor_settings').select('*'),
  ]);

  if (companiesRes.error) throw dbError('load company settings', companiesRes.error);
  if (propertiesRes.error) throw dbError('load property settings', propertiesRes.error);
  if (vendorsRes.error) throw dbError('load vendor settings', vendorsRes.error);

  const companies = companiesRes.data ?? [];
  const properties = propertiesRes.data ?? [];
  const vendors = vendorsRes.data ?? [];

  if (!companies.length && !properties.length && !vendors.length) {
    return null;
  }

  const companyRows = companies.map((c) => ({
    name: c.company as string,
    enabled: (c.enabled as boolean) ?? true,
    reason: (c.reason as string) ?? '',
  }));

  const excludedProperties: Record<string, boolean> = {};
  const foodProperties: Record<string, boolean> = {};
  const propertiesByCompany: Record<string, string[]> = {};

  properties.forEach((p) => {
    const prop = p.property as string;
    excludedProperties[prop] = (p.enabled as boolean) ?? true;
    if (p.food_analysis !== null && p.food_analysis !== undefined) {
      foodProperties[prop] = p.food_analysis as boolean;
    }
    if (p.company) {
      const co = p.company as string;
      if (!propertiesByCompany[co]) propertiesByCompany[co] = [];
      propertiesByCompany[co].push(prop);
    }
  });

  const vendorRows = vendors.map((v) => ({
    name: v.vendor as string,
    isFood: (v.is_food as boolean) ?? false,
  }));

  // goLiveDates
  const goLiveDates: Record<string, string> = {};
  companies.forEach((c) => {
    if (c.go_live_date) goLiveDates[`company:${c.company}`] = c.go_live_date as string;
  });
  properties.forEach((p) => {
    if (p.go_live_date) goLiveDates[`property:${p.property}`] = p.go_live_date as string;
  });

  // csmOverrides
  const csmOverrides: Record<string, string> = {};
  companies.forEach((c) => {
    if (c.csm_owner) csmOverrides[c.company as string] = c.csm_owner as string;
  });

  return {
    companyRows,
    excludedProperties,
    vendorRows,
    foodProperties,
    goLiveDates,
    csmOverrides,
    propertiesByCompany,
  };
}

/** Load First Orders outreach state, keyed by "email||property". */
export async function loadOutreach(): Promise<Record<string, OutreachRecord>> {
  const { data, error } = await supabase
    .from('first_order_outreach')
    .select('user_email, property, archived, archived_at, email_sent_at');

  if (error) throw dbError('load first-order outreach', error);

  const out: Record<string, OutreachRecord> = {};
  for (const row of data ?? []) {
    out[`${row.user_email}||${row.property}`] = {
      archived: (row.archived as boolean) ?? false,
      archivedAt: (row.archived_at as string) ?? null,
      emailSentAt: (row.email_sent_at as string) ?? null,
    };
  }
  return out;
}

/**
 * Update one user's outreach state. Only the provided fields change, so
 * archiving never clears a recorded email date and vice versa.
 */
export async function saveOutreach(
  userEmail: string,
  property: string,
  patch: { archived?: boolean; emailSentAt?: string }
): Promise<void> {
  const row: Record<string, unknown> = {
    user_email: userEmail,
    property,
    updated_at: new Date().toISOString(),
  };

  if (patch.archived !== undefined) {
    row.archived = patch.archived;
    // Stamp when it was archived; clear the stamp when it is un-archived.
    row.archived_at = patch.archived ? new Date().toISOString() : null;
  }
  if (patch.emailSentAt !== undefined) {
    row.email_sent_at = patch.emailSentAt;
  }

  const { error } = await supabase
    .from('first_order_outreach')
    .upsert(row, { onConflict: 'user_email,property' });

  if (error) throw dbError('save first-order outreach', error);
}
