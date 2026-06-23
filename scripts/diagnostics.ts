import { createClient } from '@supabase/supabase-js';


const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function run() {
  console.log('--- STEP 1: LOG DATABASE CONNECTION ---');
  console.log(`URL: ${url.replace(/([a-z0-9]{4})[a-z0-9]+([a-z0-9]{4})\.supabase\.co/, '$1***$2.supabase.co')}`);
  
  console.log('\n--- STEP 2 & 3: VERIFY ACTUAL COLUMNS (via select *) ---');
  // We don't have direct SQL access to information_schema via anon key. 
  // Let's select one row and see what columns are returned.
  // We can also try a specific select for one of the missing columns.
  const { data, error } = await supabase.from('predictions').select('*').limit(1);
  if (error) {
    console.error('Error fetching predictions:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns returned in row:', Object.keys(data[0]).sort());
  } else {
    console.log('Table is empty or RLS blocked reading rows. data:', data);
  }

  console.log('\n--- STEP 8: TEST SINGLE COLUMN ---');
  const { error: colError } = await supabase.from('predictions').select('trend_regime').limit(0);
  if (colError) {
    console.error('Error selecting trend_regime:', colError.message, colError.details, colError.hint, colError.code);
  } else {
    console.log('Successfully selected trend_regime. The column EXISTS and is readable by PostgREST.');
  }

  const { error: colError2 } = await supabase.from('predictions').select('calibrated_prob_up').limit(0);
  if (colError2) {
    console.error('Error selecting calibrated_prob_up:', colError2.message);
  } else {
    console.log('Successfully selected calibrated_prob_up.');
  }
}

run().catch(console.error);
