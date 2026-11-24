# Hotel Health Monitor

Next.js dashboard that scores the "health" of hotels on the Lilo procurement platform from their order activity. Orders are synced from the Lilo API into Supabase.

## Working with Federico

- Not a coder: explain things in plain, non-technical language.
- Chilean: reply in Chilean Spanish, avoid Argentine slang.
- GitHub: FedEx879. **This repo is public** — never commit secrets, customer data exports (`*.csv`, `*.xlsx`), sheet IDs or security findings.

## Lilo API (orders)

- Server-side proxy at `app/api/lilo/orders/route.ts`; the "Sync from Lilo" button in `app/page.tsx` (`handleSyncLilo`).
- Auth: `Authorization: Bearer <token>` plus header `x-from-admin: true`. Token is `LILO_API_TOKEN` in `.env.local` (gitignored); also needed in Vercel env vars and GitHub Actions secrets.
- Payload is huge (~10 MB per 100 orders, each order embeds its catalog). Full history is impossible in a browser click or Vercel request, so sync is **bounded to 90 days** and **incremental**: newest first (`orderBy=id&order=desc`), stop at order_ids already in Supabase.
- Response envelope is `{ orders, filters, total }` (flat `json.orders`).
- **Pagination is `skip=`.** `page=` and `offset=` are silently ignored and return page 1 again. `limit=100` works.
- **`vendor=<vendorId>` is the only working vendor filter.** `vendorId=`, `vendors=`, `vendorIds=` return 200 with unfiltered data. Multiple hotels: repeated `hotel[]=<id>`. There is no management-group filter — filter by `managementGroupName` in code.
- Single order: `?search=<orderId>&limit=1`. Order ids are sequential-ish integers (gaps are normal).
- Some orders always return HTTP 500 (mostly orders by deleted users, plus a few others). A Lilo backend bug; ~0.7% of orders, accepted as missing.
- Field map: order_id←`_id`, property←`hotelName`/`hotel.name`, spend←`totalPrice`, order_date←`createdAt` (Unix **seconds**), vendor←`cart.vendorName` (fallback `cart.products[0].vendorName`; top-level `vendorName` is absent), company←`managementGroupName`, user_email←`user.email`, status←`status`, go_live_date←`hotel.goLiveDate`. Line items are in `cart.products[]`.
- **CSM is not in the API**: assigned per company in the dashboard Settings (csmOverrides).
- Status filter (`isValidStatus` in analysis): everything counts except statuses containing cancelled/canceled/declined.
- Supabase `orders` needs a unique index on `order_id` for the upsert (`onConflict: 'order_id'`).

## Login (Slack code)

- Only `@inn-flow.com` emails. The server looks the email up in Slack (`users.lookupByEmail`) and DMs a 6-digit code via the existing **Orders team reviewer** Slack app (bot scopes `users:read.email`, `chat:write`).
- Code: 10 min, single use, 5 attempts, 1 resend per minute; stored hashed in Supabase table `login_codes` (`scripts/sql/login_codes.sql`).
- Session: signed cookie `hhm_session`, 7 days (`app/lib/auth.ts`, checked in `middleware.ts`).
- Env vars: `SLACK_BOT_TOKEN`, `AUTH_SECRET` (random, 32+ chars; changing it signs everyone out). `APP_USERNAME`/`APP_PASSWORD` are no longer used.

## Auburn HD Supply invoicing (separate from the health score)

Weekly Monday reconciliation of Auburn Hospitality's HD Supply orders against HD Supply invoices in a Google Sheet. Only the Lilo half is automated: `scripts/auburn-hd-orders.mjs` + `.github/workflows/auburn-hd-orders.yml` (Mondays 11:00 UTC; secrets `LILO_API_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEET_ID`).

- Append-only: watermark is the highest order id in `HD Orders in Lilo!A`; sheet history predates Supabase's 90 days.
- Pulls directly from the Lilo API with `vendor=` (not Supabase), so it doesn't depend on anyone syncing.
- One row per **order** (Federico's choice); `COLUMN_MAP` maps sheet headers at runtime, so column order can change.
- Dates pinned to `America/Chicago`.
- The HD Supply invoice half stays manual by Federico's choice — don't rebuild it.

## Lilo users lookup (separate project)

Lives in `/Users/fede/Documents/Lilo Users/` (not a git repo) with the personal skill `~/.claude/skills/lilo-users`. Kept deliberately separate from this app; snapshot re-pulled on demand. Its `.env` has a second copy of `LILO_API_TOKEN` — rotate both together.
