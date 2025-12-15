import { createClient } from '@supabase/supabase-js';

// Hardcoded keys from .env (Step 50)
const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugOrders() {
    console.log('Connecting to Supabase...');

    // 1. Fetch table info (one row) to see columns
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    if (orders.length === 0) {
        console.log('No orders found in the table.');
    } else {
        console.log('Found orders. First order keys:', Object.keys(orders[0]));
        console.log('First order status fields:', {
            status: orders[0].status,
            order_status: orders[0].order_status,
            is_paid: orders[0].is_paid
        });
    }

    // 2. Check the specific query used in KDS
    const { data: kdsOrders, error: kdsError } = await supabase
        .from('orders')
        .select('id, status, order_status')
        .neq('status', 'completed')
        .neq('status', 'cancelled');

    if (kdsError) {
        console.log('KDS Query Error (using "status"):', kdsError.message);
    } else {
        console.log(`KDS Query (neq status completed/cancelled) returned ${kdsOrders.length} orders.`);
    }
}

debugOrders();
