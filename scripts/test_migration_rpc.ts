import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function run() {
  console.log('--- 1. ACTIVE DATABASE CONNECTION INFO ---');
  console.log(`Supabase URL: ${url.replace(/([a-z0-9]{4})[a-z0-9]+([a-z0-9]{4})\.supabase\.co/, '$1***$2.supabase.co')}`);
  console.log(`Schema name: public (PostgREST default)`);
  console.log(`Table name being checked: predictions`);

  console.log('\n--- EXECUTING FIX SCHEMA RPC ---');
  const { data: rpcData, error: rpcError } = await supabase.rpc('apply_pending_migrations');
  if (rpcError) {
    console.error('RPC Error:', rpcError.message);
  } else {
    console.log('RPC Success:', rpcData);
  }

  console.log('\n--- 3. VERIFY ACTUAL COLUMNS (via select *) ---');
  const { data, error } = await supabase.from('predictions').select('*').limit(1);
  if (error) {
    console.error('Error fetching predictions:', error.message);
  } else if (data && data.length > 0) {
    console.log('Actual columns found in DB:', Object.keys(data[0]).sort());
  } else {
    console.log('Table is empty. Cannot determine columns via select *.');
  }

  console.log('\n--- 4. TEST SINGLE COLUMN ---');
  const { error: colError } = await supabase.from('predictions').select('trend_regime').limit(0);
  if (colError) {
    console.log('trend_regime exists? FALSE. Error:', colError.message);
  } else {
    console.log('trend_regime exists? TRUE.');
  }

  console.log('\n--- 8. VALIDATE PREDICTION SCHEMA LOGIC ---');
  const fields = ['trend_regime', 'calibrated_prob_up', 'confidence_score'];
  const missing = [];
  for (const field of fields) {
    const { error } = await supabase.from('predictions').select(field).limit(0);
    if (error) missing.push(field);
  }
  console.log('Missing columns from test subset:', missing);
}

run().catch(console.error);
