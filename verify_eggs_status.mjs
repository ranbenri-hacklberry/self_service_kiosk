
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEggsSupplier() {
    console.log("Checking for 'ספק ביצים' in suppliers...");
    const { data: suppliers, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('name', 'ספק ביצים');

    if (error) console.error(error);
    else {
        console.log("Found suppliers:", suppliers);
        if (suppliers.length > 0) {
            const id = suppliers[0].id;
            console.log(`Checking items linked to supplier_id ${id}...`);
            const { data: items } = await supabase
                .from('inventory_items')
                .select('id, name')
                .eq('supplier_id', id);
            console.log("Linked items:", items);
        }
    }
}

checkEggsSupplier();
