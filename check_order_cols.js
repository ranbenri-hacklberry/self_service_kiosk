
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkOrderDetails() {
    const orderId = 'f108bdda-3262-46bc-8c29-e7eee63ce767';
    console.log(`Checking order columns for ${orderId}...`);

    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Order columns found:');
    Object.keys(order).forEach(k => {
        if (order[k] !== null) {
            console.log(`- ${k}: ${typeof order[k] === 'object' ? JSON.stringify(order[k]) : order[k]}`);
        }
    });
}

checkOrderDetails();
