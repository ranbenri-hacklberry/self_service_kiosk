const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const businessId = '22222222-2222-2222-2222-222222222222';
  
  console.log('📋 Searching for simulation loyalty cards...\n');
  
  // Try the handle_loyalty_purchase directly to see if it returns a card
  const testPhones = ['0000000001', '0000000002', '0548317887'];
  
  for (const phone of testPhones) {
    const { data, error } = await supabase.rpc('handle_loyalty_purchase', {
      p_business_id: businessId,
      p_phone: phone,
      p_customer_name: 'Test',
      p_amount_spent: 0,
      p_points_to_add: 0  // Don't add points, just check
    });
    
    if (error) {
      console.log(`❌ ${phone}: ${error.message}`);
    } else {
      console.log(`📍 ${phone}: Card ID: ${data?.card_id?.slice(0,8) || 'N/A'} | Points: ${data?.new_points || 0}`);
    }
  }
}

check().catch(console.error);
