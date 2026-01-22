const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: business } = await supabase.from('businesses').select('id').limit(1);
  const bid = business[0]?.id;
  if (!bid) return;
  const { data: orders } = await supabase.from('orders').select('id, customer_name, customer_phone').eq('business_id', bid).order('created_at', { ascending: false }).limit(10);
  console.log('Orders Found:', orders.length);
  console.log(JSON.stringify(orders, null, 2));
  
  if (orders?.length) {
    const { data: items } = await supabase.from('order_items').select('order_id, mods').in('order_id', orders.map(o => o.id)).limit(20);
    console.log('Items Mods:');
    console.log(JSON.stringify(items, null, 2));
  }
}
check();
