
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function globalSearch() {
    console.log('Searching for Order 3597 everywhere...');
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', 3597);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} instances of #3597.`);
    data.forEach(o => {
        console.log(`- ID: ${o.id} | Biz: ${o.business_id} | Created: ${o.created_at} | Status: ${o.order_status} | Name: ${o.customer_name}`);
    });
}

globalSearch();
