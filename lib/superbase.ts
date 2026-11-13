import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Avoid crashing during Next.js build when deployment env vars have not been added yet.
// The UI checks isSupabaseConfigured before making any Supabase request.
export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = createClient(
  url || 'https://placeholder-project.supabase.co',
  anonKey || 'placeholder-anon-key-not-for-production',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
