
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkOldOrder() {
    const orderId = '7c6af367-b701-486f-b6f1-4932de335586';
    console.log(`Checking old successful order ${orderId}...`);

    const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    console.log('Order:', order);

    const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

    console.log('Items Count:', items?.length);
    if (items && items.length > 0) {
        console.log('Sample Item Mods:', items[0].mods);
    }
}

checkOldOrder();
