const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const businessId = '22222222-2222-2222-2222-222222222222';
  
  // Check for customers with 00* or 054 phones created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone_number, created_at')
    .eq('business_id', businessId)
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false });
    
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`📊 Customers created today: ${data?.length || 0}`);
    data?.forEach(c => {
      console.log(`  📍 ${c.name || 'NO NAME'} | ${c.phone_number}`);
    });
  }
  
  // Also check total customers
  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
    
  console.log(`\n📊 Total customers in DB: ${count}`);
}

check().catch(console.error);
