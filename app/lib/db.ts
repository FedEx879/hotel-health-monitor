import { supabase } from './supabase'
import type { RawOrderRow, SettingsPayload } from './types'

export async function upsertOrders(
  rows: RawOrderRow[]
): Promise<{ inserted: number; total: number }> {
  if (!rows.length) return { inserted: 0, total: 0 };

  const dbRows = rows
    .filter((r) => r.order_date)
    .map((r) => ({
      property: r.property,
      spend: r.spend,
      order_date: r.order_date,
      company: r.company,
      vendor: r.vendor,
      user_email: r.user_email,
      status: r.status,
      csm: r.csm,
      go_live_date: r.go_live_date || null,
    }));

  const { data, error } = await supabase
    .from('orders')
    .upsert(dbRows, {
      onConflict: 'property,order_date,spend,vendor,user_email',
      ignoreDuplicates: true,
    })
    .select();

  if (error) throw error;

  const inserted = data?.length ?? 0;
  return { inserted, total: dbRows.length };
}

export async function fetchAllOrders(): Promise<RawOrderRow[]> {
  const PAGE = 1000;
  let allRows: RawOrderRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('property, spend, order_date, company, vendor, user_email, status, csm, go_live_date')
      .order('order_date', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data.map((row) => ({
      property: row.property ?? '',
      spend: row.spend ?? 0,
      order_date: row.order_date ?? '',
      company: row.company ?? '',
      vendor: row.vendor ?? '',
      user_email: row.user_email ?? '',
      status: row.status ?? '',
      csm: row.csm ?? '',
      go_live_date: row.go_live_date ?? '',
    })));

    if (data.length < PAGE) break;
    from += PAGE;
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
    if (error) throw error;
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
    if (error) throw error;
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
    if (error) throw error;
  }
}

export async function loadSettings(): Promise<SettingsPayload | null> {
  const [companiesRes, propertiesRes, vendorsRes] = await Promise.all([
    supabase.from('company_settings').select('*'),
    supabase.from('property_settings').select('*'),
    supabase.from('vendor_settings').select('*'),
  ]);

  if (companiesRes.error) throw companiesRes.error;
  if (propertiesRes.error) throw propertiesRes.error;
  if (vendorsRes.error) throw vendorsRes.error;

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
