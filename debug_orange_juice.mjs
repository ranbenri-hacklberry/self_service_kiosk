
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugOrangeJuice() {
    console.log("Searching for 'Orange Juice' or 'מיץ תפוזים'...");

    const { data: items, error } = await supabase
        .from('inventory_items')
        .select('id, name, supplier, supplier_id')
        .ilike('name', '%תפוזים%'); // Searching for oranges

    if (error) console.error(error);
    else console.table(items);

    console.log("\nChecking Suppliers Table:");
    const { data: suppliers } = await supabase.from('suppliers').select('*');
    console.table(suppliers);
}

debugOrangeJuice();
