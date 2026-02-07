
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkRecentItems() {
    const bizId = '22222222-2222-2222-2222-222222222222';
    console.log(`Checking recent items for Biz ${bizId}...`);

    const { data: items, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${items.length} recent items.`);
    items.forEach(i => {
        console.log(`- Item ID: ${i.id} | Order ID: ${i.order_id} | Created: ${i.created_at} | Status: ${i.item_status}`);
    });
}

checkRecentItems();
