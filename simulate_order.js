
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function simulateOrder() {
    const bizId = '22222222-2222-2222-2222-222222222222';

    // Construct a payload similar to what the Kiosk sends
    const payload = {
        p_customer_phone: "0501234567",
        p_customer_name: "Simulated Test",
        p_items: [
            {
                item_id: 1, // Assume existing item
                quantity: 1,
                price: 15,
                mods: ["Test Mod"],
                item_status: "in_progress"
            }
        ],
        p_is_paid: true,
        p_final_total: 15,
        p_business_id: bizId,
        p_order_type: "dine_in"
    };

    console.log('Simulating submit_order_v3...');
    const { data, error } = await supabase.rpc('submit_order_v3', payload);

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('Order Result:', data);

        // Verify items
        const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', data.order_id);

        console.log('Items in DB:', items?.length);
    }
}

simulateOrder();
