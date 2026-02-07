
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function testHistoryRpc() {
    const bizId = '22222222-2222-2222-2222-222222222222';
    const dateStr = '2026-01-27';
    console.log(`Testing get_kds_history_orders_v3 for ${dateStr}...`);

    const { data, error } = await supabase.rpc('get_kds_history_orders_v3', {
        p_date: dateStr,
        p_business_id: bizId,
        p_limit: 100,
        p_offset: 0
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log(`RPC returned ${data?.length || 0} orders.`);
    data?.forEach(o => {
        console.log(`- #${o.order_number} | Status: ${o.order_status} | Paid: ${o.is_paid}`);
    });
}

testHistoryRpc();
