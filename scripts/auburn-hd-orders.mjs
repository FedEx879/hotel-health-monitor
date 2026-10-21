/**
 * Appends new Auburn Hospitality HD Supply orders to the "HD Orders in Lilo"
 * tab of the Auburn HD Supply Invoicing sheet.
 *
 * Pulls straight from the Lilo API — no dependency on the dashboard's Supabase
 * sync having run. Runs weekly from GitHub Actions
 * (.github/workflows/auburn-hd-orders.yml) or by hand:
 *
 *   DRY_RUN=1 node --env-file=.env.local scripts/auburn-hd-orders.mjs
 *
 * How it decides what is new: it reads the highest numeric order id already in
 * column A of the tab (the "watermark") and imports only orders above it. Rows
 * are appended; nothing existing is ever rewritten.
 *
 * Env:
 *   LILO_API_TOKEN               — admin JWT (same one the app uses)
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — service account key JSON, one line
 *   SHEET_ID                     — spreadsheet id from its URL
 *   SHEET_TAB                    — default "HD Orders in Lilo"
 *   DRY_RUN=1                    — print rows, write nothing
 *   WATERMARK=<id>               — skip Google entirely and use this watermark
 *                                  (only useful with DRY_RUN, for testing)
 */
import { google } from 'googleapis';

const LILO_URL = 'https://api.liloshop.io/product/orders';
/** HD Supply's vendor id, from the API's own `filters` list. */
const HD_SUPPLY_VENDOR_ID = '6549515fbf98f1daf1ab5018';
const MANAGEMENT_GROUP = 'Auburn Hospitality';

const PAGE_SIZE = 100;
/** Safety stop. One page is ~6-11 MB and ~30s, so this bounds a runaway scan. */
const MAX_PAGES = 15;

const SHEET_TAB = process.env.SHEET_TAB || 'HD Orders in Lilo';
const DRY_RUN = process.env.DRY_RUN === '1';

/**
 * Sheet column header -> how to fill it from a Lilo order.
 *
 * Matched against row 1 of the tab, case-insensitively, so column order can
 * change without touching this file. Headers absent from this map are left
 * empty — that is deliberate for the per-product columns (productTitle,
 * packSizes, ordered, amount, cases, productCategory, glCode, glCategory,
 * department, productStatus), since we write ONE ROW PER ORDER, not per line
 * item. Add an entry here to start filling one.
 */
const COLUMN_MAP = {
  orderid: (o) => o._id,
  dateoforder: (o) => formatDate(o.createdAt),
  period: (o) => formatPeriod(o.createdAt),
  property: (o) => o.hotelName || o.hotel?.name || '',
  propertygroup: (o) => o.managementGroupName || '',
  // NOTE: in this tab totalAmount is a per-line extended amount. Because we
  // write one row per order, it receives the ORDER total instead.
  totalamount: (o) => o.totalPrice ?? o.cart?.total?.total ?? '',
  vendorname: (o) => o.cart?.vendorName || 'HD Supply',
  user: (o) => userName(o),
  orderstatus: (o) => o.status || '',
  taxes: (o) => o.cart?.total?.tax ?? 0,
  shipping: (o) => o.cart?.total?.shipping ?? 0,
};

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function userName(o) {
  const first = o.user?.firstName || '';
  const last = o.user?.lastName || '';
  const full = `${first} ${last}`.replace(/\s+/g, ' ').trim();
  return full || o.user?.email || '';
}

/**
 * The properties are in Alabama/Georgia/Louisiana, so dates are rendered in
 * Central time rather than the machine's zone — otherwise the same order gets
 * a different date locally (Chile) than on GitHub Actions (UTC), and evening
 * orders land on the wrong day.
 */
const DATE_TZ = 'America/Chicago';

/**
 * "2026-08-12". Written with valueInputOption USER_ENTERED so Sheets stores a
 * real date value that sorts and filters correctly — unlike the older rows in
 * this tab, which are text like "Fri Dec 05 2025". createdAt is Unix seconds.
 */
function formatDate(unixSeconds) {
  if (!unixSeconds) return '';
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DATE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(unixSeconds * 1000));
}

/** "2026-08", for the tab variant that has a `period` column instead. */
function formatPeriod(unixSeconds) {
  if (!unixSeconds) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DATE_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(unixSeconds * 1000));
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}`;
}

/** Mirrors analysis.ts isValidStatus: everything except cancelled/declined. */
function isValidStatus(status) {
  const s = (status || '').toLowerCase();
  return !s.includes('cancel') && !s.includes('declin');
}

async function getSheetsClient() {
  const raw = requireEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

/** Row 1 as header strings, plus the highest numeric order id in column A. */
async function readSheetState(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: [`${SHEET_TAB}!1:1`, `${SHEET_TAB}!A:A`],
  });
  const [headerRange, idRange] = res.data.valueRanges || [];
  const headers = (headerRange?.values?.[0] || []).map((h) => String(h ?? '').trim());
  if (!headers.length) {
    throw new Error(`Tab "${SHEET_TAB}" has no header row — refusing to write blindly.`);
  }

  let watermark = 0;
  const seen = new Set();
  for (const [cell] of idRange?.values || []) {
    const id = String(cell ?? '').trim();
    if (!id) continue;
    seen.add(id);
    const n = Number(id);
    if (Number.isFinite(n) && n > watermark) watermark = n;
  }
  if (!watermark) {
    throw new Error(
      `No numeric order ids found in ${SHEET_TAB}!A — cannot determine a watermark.`
    );
  }
  return { headers, watermark, seen };
}

async function fetchPage(skip) {
  const url =
    `${LILO_URL}?orderBy=id&order=desc&vendor=${HD_SUPPLY_VENDOR_ID}` +
    `&limit=${PAGE_SIZE}&skip=${skip}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${requireEnv('LILO_API_TOKEN')}`,
      'x-from-admin': 'true',
    },
  });
  if (!res.ok) {
    // Lilo 500s on a minority of orders (deleted users, plus a second
    // serialization bug). A whole page can fail because of one bad order.
    throw new Error(`Lilo API returned HTTP ${res.status} for skip=${skip}`);
  }
  const json = await res.json();
  return { orders: json.orders || [], total: json.total ?? null };
}

/**
 * Walks HD Supply orders newest-first and collects Auburn orders above the
 * watermark. Stops as soon as a page runs past the watermark.
 */
async function fetchNewOrders(watermark) {
  const collected = [];
  let skippedBadPages = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const skip = page * PAGE_SIZE;
    let orders;
    let total;
    try {
      ({ orders, total } = await fetchPage(skip));
    } catch (err) {
      // Don't let one poisoned page end the run — note it and keep going.
      console.warn(`  ! ${err.message} — skipping this page`);
      skippedBadPages++;
      continue;
    }

    if (!orders.length) {
      console.log(`  page ${page + 1}: empty, stopping.`);
      break;
    }

    const ids = orders.map((o) => Number(o._id)).filter(Number.isFinite);
    const lowest = Math.min(...ids);
    const fresh = orders.filter(
      (o) =>
        Number(o._id) > watermark &&
        o.managementGroupName === MANAGEMENT_GROUP &&
        isValidStatus(o.status)
    );
    collected.push(...fresh);
    console.log(
      `  page ${page + 1}: ids ${Math.max(...ids)}..${lowest}` +
        `${total ? ` of ${total} HD Supply orders` : ''} | +${fresh.length} Auburn`
    );

    if (lowest <= watermark) {
      console.log('  reached the watermark, stopping.');
      if (skippedBadPages) {
        console.warn(
          `  ! ${skippedBadPages} page(s) failed and were skipped — some orders ` +
            `above the watermark may be missing. Re-run to retry them.`
        );
      }
      return collected;
    }
  }

  console.warn(
    `  ! Hit the ${MAX_PAGES}-page safety limit without reaching the watermark. ` +
      `Imported what was found; re-run to continue further back.`
  );
  return collected;
}

/** Positions each value under the right column, by header name. */
function buildRow(order, headers) {
  return headers.map((header) => {
    const fn = COLUMN_MAP[header.toLowerCase()];
    if (!fn) return '';
    const v = fn(order);
    return v === null || v === undefined ? '' : v;
  });
}

async function main() {
  const overrideWatermark = process.env.WATERMARK;
  let sheets = null;
  let headers;
  let watermark;
  let seen;

  if (overrideWatermark) {
    // Test path: no Google credentials needed.
    watermark = Number(overrideWatermark);
    headers = [
      'orderId', 'productTitle', 'vendorName', 'packSizes', 'ordered', 'amount',
      'cases', 'totalAmount', 'taxes', 'shipping', 'user', 'property',
      'productGroup', 'productCategory', 'glCode', 'glCategory', 'department',
      'dateOfOrder', 'orderStatus', 'productStatus',
    ];
    seen = new Set();
    console.log(`WATERMARK override: ${watermark} (assumed column layout)`);
  } else {
    const spreadsheetId = requireEnv('SHEET_ID');
    sheets = await getSheetsClient();
    ({ headers, watermark, seen } = await readSheetState(sheets, spreadsheetId));
    console.log(`Tab "${SHEET_TAB}": ${seen.size} existing order id(s), watermark ${watermark}.`);
    console.log(`Columns: ${headers.join(' | ')}`);
    const unmapped = headers.filter((h) => h && !COLUMN_MAP[h.toLowerCase()]);
    if (unmapped.length) console.log(`Left empty (unmapped): ${unmapped.join(', ')}`);
  }

  console.log(`\nScanning Lilo for HD Supply orders above ${watermark}...`);
  const orders = await fetchNewOrders(watermark);
  console.log(`\n${orders.length} new ${MANAGEMENT_GROUP} order(s) found.`);
  if (!orders.length) return;

  // Oldest first, so appended rows read chronologically like the rest of the tab.
  orders.sort((a, b) => Number(a._id) - Number(b._id));

  const rows = [];
  for (const o of orders) {
    if (seen.has(String(o._id))) continue; // belt and braces vs the watermark
    rows.push(buildRow(o, headers));
  }

  if (DRY_RUN) {
    console.log(`\nDRY_RUN — would append ${rows.length} row(s):\n`);
    console.log(headers.join(' | '));
    for (const r of rows) console.log(r.map((c) => (c === '' ? '—' : c)).join(' | '));
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: requireEnv('SHEET_ID'),
    range: `${SHEET_TAB}!A:A`,
    // USER_ENTERED so dateOfOrder lands as a real date and amounts as numbers,
    // rather than text. Values are ours (ids, dates, hotel names, numbers), so
    // there is nothing here Sheets could misread as a formula.
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  console.log(`\nAppended ${rows.length} row(s) to "${SHEET_TAB}".`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
