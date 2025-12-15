
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkItem36() {
    // 1. Get name of item 36
    const { data: item } = await supabase.from('menu_items').select('id, name').eq('id', 36).single();
    console.log("Item 36 is:", item);

    // 2. Count orders
    const { count } = await supabase.from('order_items').select('*', { count: 'exact', head: true }).eq('menu_item_id', 36);
    console.log(`It appears in ${count} past orders.`);
}

checkItem36();
