
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function deepSearch() {
    const bizId = '22222222-2222-2222-2222-222222222222';
    console.log(`Deep searching for items in Biz ${bizId} today...`);

    // Find all items created today for this business
    const today = new Date();
    today.setHours(5, 0, 0, 0);

    const { data: items, error } = await supabase
        .from('order_items')
        .select('*, orders(order_number, id)')
        .eq('business_id', bizId)
        .gt('created_at', today.toISOString());

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${items.length} items.`);
    items.forEach(i => {
        console.log(`- Item ID: ${i.id} | Order #: ${i.orders?.order_number} | Order ID: ${i.order_id} | Status: ${i.item_status}`);
    });
}

deepSearch();
