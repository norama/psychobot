import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabase =
  url &&
  url !== 'https://your-project-ref.supabase.co' &&
  key?.startsWith('sb_publishable_') &&
  key !== 'sb_publishable_replace_me'
    ? createClient(url, key, { auth: { flowType: 'pkce' } })
    : null

export const db = supabase!
