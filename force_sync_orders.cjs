const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function forceSync() {
  const businessId = '22222222-2222-2222-2222-222222222222';
  
  console.log('🔄 Forcing sync of orders from Supabase to local...');
  
  // Get all orders from today via RPC
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: orders, error } = await supabase.rpc('get_sales_data', {
    p_business_id: businessId,
    p_start_date: today.toISOString(),
    p_end_date: tomorrow.toISOString()
  });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log(`📦 Found ${orders?.length || 0} orders in Supabase`);
  
  // Show all orders with their names
  orders?.forEach(o => {
    console.log(`  #${o.order_number} | "${o.customer_name}" | ${o.customer_phone} | Status: ${o.order_status || 'N/A'}`);
  });
  
  // Check order_status distribution
  const statusCounts = {};
  orders?.forEach(o => {
    const status = o.order_status || 'undefined';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  console.log('\n📊 Status Distribution:', statusCounts);
  
  // Check if the issue is that order_status is not being returned
  if (orders?.length > 0 && orders[0].order_status === undefined) {
    console.log('\n⚠️ PROBLEM: order_status is not being returned by get_sales_data RPC!');
    console.log('   The Sales Dashboard RPC needs to include order_status in its response.');
  }
}

forceSync().catch(console.error);
