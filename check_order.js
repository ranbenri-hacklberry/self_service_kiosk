
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkOrder() {
    console.log('Searching for order 3597...');
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', 3597);

    if (error) {
        console.error('Error fetching order:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Order found:', JSON.stringify(data[0], null, 2));

        // Check items
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', data[0].id);

        if (itemsError) {
            console.error('Error fetching items:', itemsError);
        } else {
            console.log('Order items:', JSON.stringify(items, null, 2));
        }
    } else {
        console.log('Order 3597 NOT FOUND in orders table.');

        // Check for any recent orders
        const { data: recent } = await supabase
            .from('orders')
            .select('order_number, created_at, order_status, business_id')
            .order('created_at', { ascending: false })
            .limit(10);
        console.log('Recent orders:', recent);
    }
}

checkOrder();
