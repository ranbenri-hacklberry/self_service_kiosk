
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("Checking Suppliers...");
    const { data: suppliers, error: sErr } = await supabase.from('suppliers').select('*');
    if (sErr) console.error(sErr);
    else console.table(suppliers);

    console.log("\nChecking Inventory Items (first 50)...");
    const { data: items, error: iErr } = await supabase
        .from('inventory_items')
        .select('id, name, supplier_id')
        .not('supplier_id', 'is', null) // Filter for items that have a supplier
        .limit(50);

    if (iErr) console.error(iErr);
    else {
        console.log("Items with supplier_id found:", items.length);
        console.table(items);
    }

    console.log("\nChecking Inventory Items (without supplier)...");
    const { data: itemsNoSup, error: iErr2 } = await supabase
        .from('inventory_items')
        .select('id, name, supplier_id')
        .is('supplier_id', null)
        .limit(5);

    if (iErr2) console.error(iErr2);
    else {
        console.log("Items without supplier_id sample:", itemsNoSup.length);
        console.table(itemsNoSup);
    }
}

checkData();
