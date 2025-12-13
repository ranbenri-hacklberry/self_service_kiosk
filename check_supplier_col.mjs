
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log("Checking Inventory Items 'supplier' column...");
    const { data: items, error: iErr } = await supabase
        .from('inventory_items')
        .select('id, name, supplier')
        .not('supplier', 'is', null)
        .limit(20);

    if (iErr) console.error(iErr);
    else {
        console.log("Items with 'supplier' found:", items.length);
        console.table(items);
    }
}

checkData();
