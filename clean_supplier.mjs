
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndClean() {
    // 1. Check if 'Eggs Supplier' has any items
    const { data: items, error } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('supplier_id', 4); // Assuming 4 is the ID we saw earlier for 'ספק ביצים'

    console.log("Items still linked to Supplier ID 4:", items);

    if (items && items.length === 0) {
        console.log("No items linked. Safe to delete supplier 4.");
        const { error: delErr } = await supabase.from('suppliers').delete().eq('id', 4);
        if (delErr) console.error("Error deleting:", delErr);
        else console.log("Deleted supplier 4.");
    } else {
        console.log("Cannot delete supplier 4, items still exist.", items);
    }
}

checkAndClean();
