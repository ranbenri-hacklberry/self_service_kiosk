import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, order_status, created_at')
        .eq('business_id', '22222222-2222-2222-2222-222222222222')
        .order('created_at', { ascending: false })
        .limit(10);

    if (orderError) {
        console.error('❌ Error fetching orders:', orderError.message);
    } else {
        console.log(`📦 Orders in Demo Business (222...): ${orders.length}`);
        orders.forEach(o => console.log(`- #${o.order_number}: ${o.order_status} (${o.created_at})`));
    }
}

check();
