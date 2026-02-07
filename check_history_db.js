
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkHistory() {
    const bizId = '22222222-2222-2222-2222-222222222222';
    console.log(`Checking history for Biz ${bizId} today...`);

    // Check all orders created today
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('business_id', bizId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

    console.log(`Found ${orders?.length || 0} orders today.`);
    orders?.forEach(o => {
        console.log(`- Order #${o.order_number} | ID: ${o.id} | Status: ${o.order_status} | Paid: ${o.is_paid}`);
    });
}

checkHistory();
