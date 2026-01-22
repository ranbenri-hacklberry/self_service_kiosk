const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function debugLoyalty() {
  const businessId = '22222222-2222-2222-2222-222222222222';
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 LOYALTY SYSTEM DEBUG');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Check if the function exists
  console.log('📋 TEST 1: Function Existence Check');
  console.log('-----------------------------------');
  const { data: funcs, error: funcErr } = await supabase.rpc('handle_loyalty_purchase', {
    p_business_id: businessId,
    p_phone: '0000000001',
    p_customer_name: 'Test Freddie',
    p_amount_spent: 50,
    p_points_to_add: 1
  });
  
  if (funcErr) {
    console.log('❌ Function call FAILED:', funcErr.message);
    console.log('   Details:', funcErr);
  } else {
    console.log('✅ Function call SUCCESS:', JSON.stringify(funcs, null, 2));
  }

  // Test 2: Check loyalty_cards table
  console.log('\n📋 TEST 2: Loyalty Cards in Database');
  console.log('-------------------------------------');
  const { data: cards, error: cardsErr } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (cardsErr) {
    console.log('❌ Query failed:', cardsErr.message);
  } else {
    console.log(`Found ${cards?.length || 0} loyalty cards:`);
    cards?.forEach(c => {
      console.log(`  📍 ${c.customer_phone} | Points: ${c.points_balance} | Created: ${c.created_at?.slice(0,10)}`);
    });
  }

  // Test 3: Check loyalty_transactions
  console.log('\n📋 TEST 3: Recent Loyalty Transactions');
  console.log('---------------------------------------');
  const { data: txs, error: txErr } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (txErr) {
    console.log('❌ Query failed:', txErr.message);
  } else {
    console.log(`Found ${txs?.length || 0} transactions:`);
    txs?.forEach(t => {
      console.log(`  📍 Card: ${t.card_id?.slice(0,8)} | Type: ${t.transaction_type} | Change: ${t.change_amount} | Balance: ${t.balance_after}`);
    });
  }

  // Test 4: Check customers table
  console.log('\n📋 TEST 4: Customers with 00* phones');
  console.log('-------------------------------------');
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('*')
    .eq('business_id', businessId)
    .like('phone', '00%')
    .limit(10);
    
  if (custErr) {
    console.log('❌ Query failed:', custErr.message);
  } else {
    console.log(`Found ${customers?.length || 0} test customers:`);
    customers?.forEach(c => {
      console.log(`  📍 ${c.name || 'NO NAME'} | Phone: ${c.phone}`);
    });
  }

  // Test 5: Check if submit_order_v3 calls handle_loyalty_purchase
  console.log('\n📋 TEST 5: Orders with points_added field');
  console.log('------------------------------------------');
  const { data: orders, error: ordErr } = await supabase
    .from('orders')
    .select('order_number, customer_name, customer_phone, points_added')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (ordErr) {
    console.log('❌ Query failed:', ordErr.message);
  } else {
    console.log(`Recent orders:`);
    orders?.forEach(o => {
      console.log(`  📍 #${o.order_number} | ${o.customer_name || 'Guest'} | Phone: ${o.customer_phone || 'N/A'} | Points: ${o.points_added ?? 'NULL'}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🏁 DEBUG COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
}

debugLoyalty().catch(console.error);
