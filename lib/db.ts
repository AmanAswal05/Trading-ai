import { isSupabaseConfigured, supabase } from './supabase';

export { isSupabaseConfigured };

// Unified Data Service
export const DbService = {
  // Checks PostgreSQL/Supabase database connectivity or logs query
  async listScans(userId: string | null): Promise<Record<string, unknown>[]> {
    if (isSupabaseConfigured && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Run a simple query to verify connection to the active database
      let query = supabase.from('stock_searches').select('*').limit(5);
      if (userId) {
        query = query.eq('user_id', userId);
      }
      const { data, error } = await query;

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
