const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
let supabaseUrl = '';
let supabaseAnonKey = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
        supabaseUrl = value;
      } else if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
        supabaseAnonKey = value;
      }
    }
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Supabase environment variables are missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing Supabase connection to:', supabaseUrl);
  
  // 1. Try selecting a single row to see what columns are in the response
  const { data, error } = await supabase.from('predictions').select('*').limit(1);
  if (error) {
    console.error('Error selecting from predictions table:', error);
  } else {
    console.log('Successfully queried predictions table.');
    if (data && data.length > 0) {
      console.log('Columns found in first record:', Object.keys(data[0]));
    } else {
      console.log('No predictions records found, table is empty.');
    }
  }

  // 2. Check the required columns individually
  const columnsToCheck = [
    'calibrated_prob_up',
    'max_position_size',
    'is_tradeable_signal',
    'signal_strength',
    'market_regime'
  ];

  console.log('\nChecking columns individually:');
  for (const col of columnsToCheck) {
    const { error: colError } = await supabase.from('predictions').select(col).limit(1);
    if (colError) {
      console.log(`❌ Column "${col}" is NOT accessible/present. Error:`, colError.message);
    } else {
      console.log(`✅ Column "${col}" is present.`);
    }
  }
  
  // 3. Test if apply_pending_migrations RPC exists
  console.log('\nTesting apply_pending_migrations RPC:');
  const { data: rpcData, error: rpcError } = await supabase.rpc('apply_pending_migrations');
  if (rpcError) {
    console.log('❌ RPC function apply_pending_migrations failed. Error:', rpcError.message);
  } else {
    console.log('✅ RPC function apply_pending_migrations executed successfully:', rpcData);
  }
}

test();
