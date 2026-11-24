-- One pending sign-in code per email. Run once in the Supabase SQL editor.
-- Only the server (service role key) touches this table; RLS on with no
-- policies blocks the public anon key entirely.
create table if not exists login_codes (
  email        text primary key,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  last_sent_at timestamptz not null default now()
);

alter table login_codes enable row level security;

-- Newer Supabase projects don't grant new tables to the server role automatically.
grant select, insert, update, delete on table login_codes to service_role;
