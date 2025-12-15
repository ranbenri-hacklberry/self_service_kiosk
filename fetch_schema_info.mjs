
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchSchema() {
    console.log('Fetching columns for orders table...');

    // Try to access information_schema directly via PostgREST
    // This often fails depending on permissions, but worth a shot if the user suggests "get schema"
    // Note: Supabase exposes some system tables via 'introspect' but usually not via JS client default 'public' schema

    // However, we can try to infer the schema by selecting one row from key tables.

    const tables = ['orders', 'order_items', 'menu_items', 'customers'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Error fetching ${table}:`, error.message);
        } else if (data.length > 0) {
            console.log(`\nTable: ${table}`);
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log(`\nTable: ${table} (Empty)`);
        }
    }
}

fetchSchema().catch(console.error);
