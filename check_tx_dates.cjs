const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const businessId = '22222222-2222-2222-2222-222222222222';
  
  const { data: txs } = await supabase.rpc('get_loyalty_transactions_for_sync', {
    p_business_id: businessId
  });
  
  console.log(`Total transactions: ${txs?.length || 0}`);
  
  // Check dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayTxs = txs?.filter(t => new Date(t.created_at) >= today);
  console.log(`Today's transactions: ${todayTxs?.length || 0}`);
  
  todayTxs?.forEach(t => {
    console.log(`  📍 Card: ${t.card_id?.slice(0,8)} | Change: ${t.change_amount} | Created: ${t.created_at}`);
  });
  
  // Check if balance_after exists
  if (txs?.length > 0) {
    console.log('\nFirst transaction structure:', Object.keys(txs[0]));
  }
}

check().catch(console.error);
