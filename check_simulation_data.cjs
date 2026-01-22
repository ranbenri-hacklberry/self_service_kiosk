const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  // Get business ID
  const { data: businesses } = await supabase.from('businesses').select('id').limit(1);
  const businessId = businesses?.[0]?.id;
  if (!businessId) return console.log('No business found');

  console.log('=== CHECKING SIMULATION DATA ===\n');

  // Check recent orders
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, customer_phone, order_status, created_at')
    .eq('business_id', businessId)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('📦 RECENT ORDERS (last 24h):');
  console.log('----------------------------');
  if (ordersErr) console.log('Error:', ordersErr.message);
  else {
    orders?.forEach(o => {
      console.log(`#${o.order_number} | ${o.customer_name || '(NO NAME)'} | ${o.customer_phone || '(NO PHONE)'} | ${o.order_status}`);
    });
    console.log(`Total: ${orders?.length || 0} orders\n`);
  }

  // Check loyalty cards
  const { data: loyalty, error: loyaltyErr } = await supabase
    .from('loyalty_cards')
    .select('customer_phone, points_balance, total_purchases, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('🎁 LOYALTY CARDS:');
  console.log('-----------------');
  if (loyaltyErr) console.log('Error:', loyaltyErr.message);
  else {
    loyalty?.forEach(l => {
      console.log(`${l.customer_phone} | Points: ${l.points_balance} | Purchases: ${l.total_purchases}`);
    });
    console.log(`Total: ${loyalty?.length || 0} cards\n`);
  }

  // Check customers table
  const { data: customers, error: customersErr } = await supabase
    .from('customers')
    .select('id, full_name, phone, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('👥 CUSTOMERS:');
  console.log('-------------');
  if (customersErr) console.log('Error:', customersErr.message);
  else {
    customers?.forEach(c => {
      console.log(`${c.full_name || '(NO NAME)'} | ${c.phone || '(NO PHONE)'}`);
    });
    console.log(`Total: ${customers?.length || 0} customers\n`);
  }

  // Check if there are phones starting with 00
  const simulatedPhones = orders?.filter(o => o.customer_phone?.startsWith('00')).length || 0;
  const simulatedLoyalty = loyalty?.filter(l => l.customer_phone?.startsWith('00')).length || 0;
  
  console.log('🔍 SIMULATION PHONE CHECK:');
  console.log(`  Orders with 00* phones: ${simulatedPhones}`);
  console.log(`  Loyalty cards with 00* phones: ${simulatedLoyalty}`);
  
  if (simulatedPhones > 0 && simulatedLoyalty === 0) {
    console.log('\n⚠️ PROBLEM DETECTED: Orders exist with 00* phones but NO loyalty cards!');
    console.log('   This confirms handle_loyalty_purchase is rejecting these phone numbers.');
  }
}

check().catch(console.error);
