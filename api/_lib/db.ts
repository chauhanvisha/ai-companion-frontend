import { createClient } from '@supabase/supabase-js'

export function db() {
  const url = process.env.SUPABASE_URL
  // Prefer the service_role key (bypasses RLS, server-side only) so we can safely
  // enable Row Level Security on every table. Falls back to the anon key until the
  // service_role key is added to the environment, so deploys never break mid-rollout.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and a Supabase key are required')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
