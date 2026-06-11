import { supabase } from './supabase';

// Environment variables configuration check
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = 
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

// Unified Data Service
export const DbService = {
  // Checks PostgreSQL/Supabase database connectivity or logs query
  async listScans(userId: string | null): Promise<any[]> {
    if (isSupabaseConfigured && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Run a simple query to verify connection to the active database
      const { data, error } = await supabase
        .from('stock_searches')
        .select('*')
        .limit(5);

      if (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }
      return data || [];
    } else {
      // Fallback for mock mode
      console.warn('[DbService] Supabase not configured. Simulating healthy connection.');
      return [
        { id: '1', stock_symbol: 'AAPL', searched_at: new Date().toISOString() }
      ];
    }
  }
};
