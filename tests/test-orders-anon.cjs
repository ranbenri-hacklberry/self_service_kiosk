const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    const businessId = '22222222-2222-2222-2222-222222222222';
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('business_id', businessId)
        .limit(5);

    if (error) {
        console.error('Error fetching orders:', error.message);
    } else {
        console.log('Orders found:', data.length);
        if (data.length > 0) console.log('First order status:', data[0].order_status);
    }
}

test();
