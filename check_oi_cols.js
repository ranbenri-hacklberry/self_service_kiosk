
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkOrderItemsCols() {
    console.log('Checking order_items columns...');

    const { data: item } = await supabase.from('order_items').select('*').limit(1).single();
    if (item) {
        console.log('Order Item Columns:', Object.keys(item));
    } else {
        console.log('No items found to check columns.');
    }
}

checkOrderItemsCols();
