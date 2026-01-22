const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const businessId = '22222222-2222-2222-2222-222222222222';
  
  console.log('📋 Checking get_loyalty_cards_for_sync...');
  const { data: cards, error: cardsErr } = await supabase.rpc('get_loyalty_cards_for_sync', {
    p_business_id: businessId
  });
  
  if (cardsErr) {
    console.log('❌ Error:', cardsErr.message);
  } else {
    console.log(`✅ Found ${cards?.length || 0} loyalty cards`);
    cards?.slice(0, 5).forEach(c => {
      console.log(`  📍 ${c.customer_phone} | Points: ${c.points_balance}`);
    });
  }

  console.log('\n📋 Checking get_loyalty_transactions_for_sync...');
  const { data: txs, error: txErr } = await supabase.rpc('get_loyalty_transactions_for_sync', {
    p_business_id: businessId
  });
  
  if (txErr) {
    console.log('❌ Error:', txErr.message);
  } else {
    console.log(`✅ Found ${txs?.length || 0} transactions`);
    txs?.slice(0, 5).forEach(t => {
      console.log(`  📍 Card: ${t.card_id?.slice(0,8)} | Change: ${t.change_amount} | Balance: ${t.balance_after}`);
    });
  }

  // Also check direct table access
  console.log('\n📋 Direct table access check...');
  const { data: directCards, error: directErr } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('business_id', businessId)
    .limit(5);
    
  if (directErr) {
    console.log('❌ Direct access error:', directErr.message);
  } else {
    console.log(`✅ Direct: Found ${directCards?.length || 0} cards`);
  }
}

check().catch(console.error);
