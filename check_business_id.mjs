
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkBusinessId() {
    console.log('Checking business_id usage in ORDERS table...');

    // Check if business_id column exists and is nullable
    // Since we can't check schema easily, we'll check recent orders

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, business_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.log('Error fetching orders:', error.message);
    } else {
        console.log('Recent Orders:');
        orders.forEach(o => {
            console.log(`Order #${o.order_number}: business_id = ${o.business_id}`);
        });
    }

    // Attempt to insert a dummy order without business_id to see if it fails
    // actually, submit_order_v2 uses SECURITY DEFINER so it might bypass RLS for insertion if not careful, but constraints still apply.

    // Also, check if RLS is enabled on orders? Can't easily check via client.
}

checkBusinessId().catch(console.error);
