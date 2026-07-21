import { createClient } from '@supabase/supabase-js';

// Server-only client — uses the service role key, which bypasses Row Level
// Security. Never import this file from client components; it must only run
// in API routes / server code, and SUPABASE_SERVICE_ROLE_KEY must never be
// exposed with a NEXT_PUBLIC_ prefix.
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
