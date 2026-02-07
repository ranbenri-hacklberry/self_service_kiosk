
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkKDS() {
    const today = new Date();
    today.setHours(5, 0, 0, 0); // Day starts at 5 AM

    console.log(`Checking KDS orders for today (since ${today.toISOString()})...`);

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, order_status, created_at, business_id, customer_name')
        .gt('created_at', today.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${orders.length} orders for today.`);
    orders.forEach(o => {
        console.log(`Order #${o.order_number} | Status: ${o.order_status} | Created: ${o.created_at} | Biz: ${o.business_id} | Name: ${o.customer_name}`);
    });

    const target = orders.find(o => o.order_number == 3597);
    if (target) {
        console.log('\n--- Details for Order #3597 ---');
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', target.id);
        console.log('Items:', JSON.stringify(items, null, 2));
    }
}

checkKDS();
