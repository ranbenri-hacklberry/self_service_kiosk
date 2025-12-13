
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCols() {
    console.log("Checking columns for supplier_order_items...");
    // Try to select minimal columns to see what works
    const { data, error } = await supabase.from('supplier_order_items').select('*').limit(1);

    if (error) {
        console.log("Error selecting *:", error.message);
    } else {
        if (data.length > 0) {
            console.log("Existing keys:", Object.keys(data[0]));
        } else {
            console.log("Table is empty, cannot deduce keys from data.");
            // Try to select 'quantity' specifically
            const { error: qError } = await supabase.from('supplier_order_items').select('quantity').limit(1);
            console.log("Select 'quantity' success:", !qError);
            if (qError) console.log("Error:", qError.message);

            // Try to select 'qty' specifically
            const { error: qtyError } = await supabase.from('supplier_order_items').select('qty').limit(1);
            console.log("Select 'qty' success:", !qtyError);
        }
    }
}

checkCols();
