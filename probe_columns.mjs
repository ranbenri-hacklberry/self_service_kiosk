
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function probe() {
    // Check if 'items' column exists in supplier_orders (we know it failed before)
    // Check if 'supplier_name' exists
    const t1 = await supabase.from('supplier_orders').select('supplier_name').limit(1);
    console.log("supplier_orders.supplier_name:", t1.error ? t1.error.message : "Exists");

    // Check supplier_order_items column names
    const t2 = await supabase.from('supplier_order_items').select('order_id').limit(1);
    console.log("supplier_order_items.order_id:", t2.error ? t2.error.message : "Exists");

    const t3 = await supabase.from('supplier_order_items').select('supplier_order_id').limit(1);
    console.log("supplier_order_items.supplier_order_id:", t3.error ? t3.error.message : "Exists");

    const t4 = await supabase.from('supplier_order_items').select('item_id').limit(1);
    console.log("supplier_order_items.item_id:", t4.error ? t4.error.message : "Exists");

    const t5 = await supabase.from('supplier_order_items').select('inventory_item_id').limit(1);
    console.log("supplier_order_items.inventory_item_id:", t5.error ? t5.error.message : "Exists");
}

probe();
