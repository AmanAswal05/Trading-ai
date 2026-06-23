import { NextRequest } from 'next/server';
import { isAdminEmail } from './admin-auth';
import { isSupabaseConfigured, supabase } from './supabase';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
}

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function getAuthenticatedAdmin(request: NextRequest): Promise<AuthenticatedAdmin | null> {
  if (!isSupabaseConfigured) {
    const mockUserCookie = request.cookies.get('sp_mock_user');
    if (!mockUserCookie) return null;

    try {
      const email = decodeURIComponent(mockUserCookie.value);
      return isAdminEmail(email) ? { id: 'mock-user-id', email } : null;
    } catch {
      return null;
    }
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // getClaims verifies the JWT signature locally when asymmetric signing is enabled.
      const { data, error } = await supabase.auth.getClaims(token);
      const email = typeof data?.claims?.email === 'string' ? data.claims.email : null;
      const id = typeof data?.claims?.sub === 'string' ? data.claims.sub : null;

      if (!error && email && id) {
        return isAdminEmail(email) ? { id, email } : null;
      }
    } catch (error) {
      if (attempt === 2) {
        console.warn('Admin token verification temporarily unavailable:', error);
      }
    }

    if (attempt < 2) await sleep(150 * (attempt + 1));
  }

  return null;
}
