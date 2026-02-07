
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkSchema() {
    console.log('Checking menu_items schema...');
    // We can't easily check schema without RPC or complex queries, 
    // but we can check the IDs of a few items.

    const { data: items } = await supabase.from('menu_items').select('id').limit(5);
    console.log('Sample Menu Item IDs:', items);

    if (items && items.length > 0) {
        console.log('Type of ID:', typeof items[0].id);
    }
}

checkSchema();
