require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Fetching 1 row...');
  const { data: rows, error: fetchErr } = await supabase.from('predictions').select('*').limit(1);
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  if (!rows || rows.length === 0) {
    console.log('No rows found');
    return;
  }
  
  const row = rows[0];
  console.log('Original row ID:', row.id);
  
  // Try to upsert it back
  const { error: upsertErr } = await supabase.from('predictions').upsert([row]);
  if (upsertErr) {
    console.error('Upsert error:', upsertErr);
  } else {
    console.log('Upsert successful');
  }
}

test();
