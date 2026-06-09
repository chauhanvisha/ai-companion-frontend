import { createClient } from '@supabase/supabase-js'

export function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required')
  return createClient(url, key)
}
