
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSuppliersAndEggs() {
    // 1. Get all suppliers
    console.log("Current Suppliers Table:");
    const { data: suppliers, error: sErr } = await supabase.from('suppliers').select('*');
    if (sErr) console.error(sErr);
    else console.table(suppliers);

    // 2. Check the specific item 'Eggs' or similar to see its original supplier text
    console.log("\nChecking 'Eggs' items:");
    const { data: items, error: iErr } = await supabase
        .from('inventory_items')
        .select('id, name, supplier, supplier_id')
        .ilike('name', '%ביצים%');

    if (iErr) console.error(iErr);
    else console.table(items);
}

checkSuppliersAndEggs();
