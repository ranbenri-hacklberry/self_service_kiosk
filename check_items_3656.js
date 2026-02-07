
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkItems3656() {
    const orderId = '433460e3-95f0-460a-b012-e8877a10e6cb';
    console.log(`Checking items for Order ${orderId}...`);

    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

    items?.forEach(i => {
        console.log(`- Item: ${i.id} | Status: ${i.item_status}`);
    });
}

checkItems3656();
