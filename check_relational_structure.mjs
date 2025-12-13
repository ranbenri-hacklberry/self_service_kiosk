
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStructure() {
    console.log("Checking supplier_orders...");
    const { data: orders, error: ordersError } = await supabase.from('supplier_orders').select('*').limit(1);
    if (ordersError) console.error("Orders Error:", ordersError);
    else console.log("Orders Data (keys):", orders.length ? Object.keys(orders[0]) : "Empty table");

    console.log("\nChecking supplier_order_items...");
    const { data: items, error: itemsError } = await supabase.from('supplier_order_items').select('*').limit(1);
    if (itemsError) console.error("Items Error:", itemsError);
    else console.log("Items Data (keys):", items.length ? Object.keys(items[0]) : "Empty table");
}

checkStructure();
