
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase
        .from('supplier_orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
    } else {
        // Since it's empty, we might not get keys. Let's try to insert a dummy to get error or success.
        // Or just try to read column info if possible.
        // Actually, I'll assume standard helpful error if I try to select a non-existent column, 
        // but let's try to fetch columns via an RPC or just guessing if data is empty.
        // Limit 1 on empty table returns empty array.

        console.log("Data:", data);
    }
}

checkSchema();
