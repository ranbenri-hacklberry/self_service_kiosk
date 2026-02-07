
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkItems() {
    const orderId = 'f108bdda-3262-46bc-8c29-e7eee63ce767'; // Biz 2222's 3597
    console.log(`Checking items for Order ${orderId}...`);

    const { data: items, error } = await supabase
        .from('order_items')
        .select('*, menu_items(name, kds_routing_logic)')
        .eq('order_id', orderId);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Items found:', JSON.stringify(items, null, 2));
}

checkItems();
