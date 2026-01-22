const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
  console.log('📋 Checking table schemas...\n');

  // Check customers columns
  const { data: cust } = await supabase.from('customers').select('*').limit(1);
  if (cust && cust[0]) {
    console.log('👥 CUSTOMERS columns:', Object.keys(cust[0]).join(', '));
  } else {
    console.log('👥 CUSTOMERS: No data or error');
  }

  // Check orders columns  
  const { data: orders } = await supabase.from('orders').select('*').limit(1);
  if (orders && orders[0]) {
    console.log('📦 ORDERS columns:', Object.keys(orders[0]).join(', '));
  } else {
    console.log('📦 ORDERS: No data or error');
  }

  // Check loyalty_cards columns
  const { data: cards } = await supabase.from('loyalty_cards').select('*').limit(1);
  if (cards && cards[0]) {
    console.log('🎁 LOYALTY_CARDS columns:', Object.keys(cards[0]).join(', '));
  } else {
    console.log('🎁 LOYALTY_CARDS: No data or error');
  }
}

checkSchema().catch(console.error);
