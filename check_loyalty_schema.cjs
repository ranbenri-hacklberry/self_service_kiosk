const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  // Get actual schema from information_schema
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'loyalty_cards' });
  
  if (error) {
    // Fallback: try to insert and see what columns exist
    console.log('Checking loyalty_cards structure...');
    
    const { error: insertErr } = await supabase
      .from('loyalty_cards')
      .insert({
        business_id: '22222222-2222-2222-2222-222222222222',
        customer_phone: '0000000099',
        points_balance: 0
      });
    
    if (insertErr) {
      console.log('Insert test error:', insertErr.message);
      console.log('Details:', insertErr.details);
    } else {
      console.log('Insert worked! Cleaning up...');
      await supabase.from('loyalty_cards').delete().eq('customer_phone', '0000000099');
    }
  } else {
    console.log('Columns:', data);
  }
}

check().catch(console.error);
