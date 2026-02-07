import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('🔍 Probing live system for ranbenri@gmail.com...');

    // Try employees table instead
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*, businesses(name, id)')
        .eq('email', 'ranbenri@gmail.com');

    if (empError) {
        console.error('❌ Error fetching employee:', empError.message);
    } else {
        console.log('👷 Employee Records:', employees.map(e => ({
            id: e.id,
            name: e.name,
            business_id: e.business_id,
            business_name: e.businesses?.name,
            email: e.email
        })));
    }

    // Check recent orders across ALL businesses to see where they are
    console.log('🕵️ Checking recent orders across all businesses (last 2 hours)...');
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: recentOrders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, order_status, business_id, created_at')
        .gt('created_at', twoHoursAgo);

    if (orderError) {
        console.error('❌ Error fetching orders:', orderError.message);
    } else {
        console.log(`📦 Found ${recentOrders.length} orders in last 2 hours:`);
        recentOrders.forEach(o => console.log(`- #${o.order_number}: ${o.order_status} (ID: ${o.id}, Biz: ${o.business_id})`));
    }
}

check();
