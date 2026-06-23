import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function isValidSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !value.includes('your-supabase-url');
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = isValidSupabaseUrl(supabaseUrl) && Boolean(supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Warning: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Supabase functionality will run in fallback/mock mode.'
  );
}

const mockSupabase = {
  auth: {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    async getUser() {
      return { data: { user: null }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: null) => void) {
      // Keep the same shape as the real client, but never hit the network.
      const timer = setTimeout(() => callback('SIGNED_OUT', null), 0);
      return {
        data: {
          subscription: {
            unsubscribe() {
              clearTimeout(timer);
            },
          },
        },
      };
    },
    async signOut() {
      return { error: null };
    },
  },
  from() {
    throw new Error('Supabase is not configured. Database access is unavailable in mock mode.');
  },
};

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (mockSupabase as unknown as SupabaseClient);
