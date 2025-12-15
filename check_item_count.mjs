
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function countItems() {
    const { count, error } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true });

    if (error) console.error(error);
    else console.log("Total inventory items in DB:", count);

    console.log("\nFetching items with ID > 95:");
    const { data, error: dErr } = await supabase
        .from('inventory_items')
        .select('id, name')
        .gt('id', 95)
        .order('id');

    if (dErr) console.error(dErr);
    else console.table(data);
}

countItems();
