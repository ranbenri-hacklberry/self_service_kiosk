const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const businessId = '22222222-2222-2222-2222-222222222222';
  
  console.log('📋 Testing get_all_loyalty_cards...');
  const { data, error } = await supabase.rpc('get_all_loyalty_cards', {
    p_business_id: businessId
  });
  
  if (error) {
    console.log('❌ Error:', error.message);
    console.log('Details:', error);
  } else {
    console.log(`✅ Found ${data?.length || 0} cards`);
    data?.slice(0, 10).forEach(c => {
      console.log(`  📍 ${c.customer_phone} | Points: ${c.points_balance}`);
    });
  }
}

test().catch(console.error);
