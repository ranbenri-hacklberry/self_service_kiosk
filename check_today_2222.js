
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkTodayBiz2222() {
    const bizId = '22222222-2222-2222-2222-222222222222';
    const today = new Date();
    today.setHours(5, 0, 0, 0);

    console.log(`Checking orders for Biz ${bizId} today...`);
    const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, created_at, customer_name')
        .eq('business_id', bizId)
        .gt('created_at', today.toISOString());

    console.log(`Found ${orders?.length || 0} orders.`);
    for (const o of (orders || [])) {
        const { data: items } = await supabase.from('order_items').select('id').eq('order_id', o.id);
        console.log(`Order #${o.order_number} | Total: ${o.total_amount} | Items Count: ${items?.length || 0}`);
    }
}

checkTodayBiz2222();
