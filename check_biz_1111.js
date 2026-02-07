
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkBiz1111() {
    const orderId = '443489db-5cfe-4829-b4a5-fcaf823e9e76'; // Biz 1111's 3597
    console.log(`Checking items for Order ${orderId} (Biz 1111)...`);

    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

    console.log('Items found:', items?.length);
    if (items && items.length > 0) {
        items.forEach(i => {
            console.log(`- Item: ${i.id} | Status: ${i.item_status}`);
        });
    }
}

checkBiz1111();
