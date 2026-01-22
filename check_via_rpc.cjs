const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  console.log('=== CHECKING VIA RPC (bypasses RLS) ===\n');
  
  // Use get_sales_data RPC which bypasses RLS
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabase.rpc('get_sales_data', {
    p_business_id: '22222222-2222-2222-2222-222222222222',
    p_start_date: today.toISOString(),
    p_end_date: tomorrow.toISOString()
  });

  if (error) {
    console.log('RPC Error:', error.message);
    return;
  }

  console.log(`📦 ORDERS TODAY: ${data?.length || 0}`);
  console.log('----------------------------');
  
  data?.forEach(o => {
    console.log(`#${o.order_number} | "${o.customer_name || 'NO NAME'}" | ${o.customer_phone || 'NO PHONE'} | ${o.order_status} | Items: ${o.order_items?.length || 0}`);
  });

  // Count phones starting with 00
  const simPhones = data?.filter(o => o.customer_phone?.startsWith('00') || o.customer_phone?.startsWith('000')).length || 0;
  console.log(`\n🔍 Orders with simulated (00*) phones: ${simPhones}`);
  
  // Check names
  const withNames = data?.filter(o => o.customer_name && o.customer_name !== 'אורח').length || 0;
  const withoutNames = data?.filter(o => !o.customer_name || o.customer_name === 'אורח').length || 0;
  console.log(`✅ Orders WITH names: ${withNames}`);
  console.log(`❌ Orders WITHOUT names: ${withoutNames}`);
}

check().catch(console.error);
