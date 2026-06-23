import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';
import { PREDICTION_SCHEMA_FIELDS } from '@/lib/predictions-db';

export const dynamic = 'force-dynamic';
const SCHEMA_CHECK_RETRIES = 3;
const SCHEMA_CHECK_RETRY_DELAY_MS = 750;

/**
 * POST /api/admin/migrate
 *
 * Applies pending database migrations by calling the
 * `apply_pending_migrations()` Postgres function defined in
 * migrations/20260614_apply_pending_migrations_fn.sql.
 *
 * That function runs as SECURITY DEFINER (postgres-level privileges) so it
 * can execute ALTER TABLE even though the Next.js server only has the anon
 * key.  It is idempotent — safe to call multiple times.
 *
 * After a successful call the PostgREST schema cache is reloaded
 * automatically via NOTIFY pgrst, 'reload schema' inside the function.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    );
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      ok: true,
      mode: 'mock',
      message: 'Running in mock-DB mode — no Supabase migrations needed.',
      applied: [],
      skipped: ['calibrated_prob_up', 'max_position_size'],
    });
  }

  try {
    // Attempt to call the migration helper function.
    const { data, error } = await supabase.rpc('apply_pending_migrations');

    if (error) {
      // If the function doesn't exist yet, provide a clear instruction.
      if (
        error.message.includes('function') &&
        (error.message.includes('not exist') || error.message.includes('does not exist') || error.code === '42883')
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Migration helper function not installed.',
            instruction:
              'Open your Supabase project → SQL Editor → New Query, paste the contents of ' +
              'migrations/20260614_apply_pending_migrations_fn.sql, and click Run. ' +
              'Then call this endpoint again.',
          },
          { status: 424 } // 424 Failed Dependency
        );
      }

      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 500 }
      );
    }

    let missingColumns: string[] = [];
    let results: { column: string; present: boolean }[] = [];

    for (let attempt = 1; attempt <= SCHEMA_CHECK_RETRIES; attempt++) {
      // Wait a short moment to allow the PostgREST cache NOTIFY to propagate.
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, SCHEMA_CHECK_RETRY_DELAY_MS * attempt));
      }

      const requiredColumns = PREDICTION_SCHEMA_FIELDS;
      results = await Promise.all(
        requiredColumns.map(async (col) => {
          const { error: checkErr } = await supabase.from('predictions').select(col).limit(0);
          return { column: col, present: !checkErr };
        })
      );

      missingColumns = results.filter((r) => !r.present).map((r) => r.column);
      if (missingColumns.length === 0) {
        break;
      }
    }

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Migration function ran successfully, but the database is STILL missing ${missingColumns.length} columns (e.g. ${missingColumns.slice(0, 3).join(', ')}).`,
          instruction:
            'Your installed apply_pending_migrations function is likely OUTDATED. ' +
            'Please open your Supabase project → SQL Editor → New Query, paste the LATEST contents of ' +
            'migrations/20260614_apply_pending_migrations_fn.sql, and click Run to update the function. ' +
            'Then call this endpoint again.',
        },
        { status: 422 } // 422 Unprocessable Entity - the helper exists but doesn't do what's required
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Migrations applied successfully. PostgREST schema cache reloaded.',
      result: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/migrate
 *
 * Reports which columns are currently present in the predictions table
 * without making any changes.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized. Admin access required.' },
      { status: 403 }
    );
  }

  const requiredColumns = PREDICTION_SCHEMA_FIELDS;

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      ok: true,
      mode: 'mock',
      columns: requiredColumns.map((col) => ({ column: col, present: true })),
    });
  }

  const results = await Promise.all(
    requiredColumns.map(async (col) => {
      const { error } = await supabase.from('predictions').select(col).limit(0);
      return { column: col, present: !error, error: error?.message };
    })
  );

  const allPresent = results.every((r) => r.present);

  return NextResponse.json({
    ok: allPresent,
    columns: results,
    message: allPresent
      ? 'All required columns are present.'
      : 'Some columns are missing — POST to this endpoint to apply migrations.',
  });
}
