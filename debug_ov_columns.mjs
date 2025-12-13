
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Try to get env vars from .env file or process.env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    // We can't run raw SQL easily with just anon key usually, unless we have a specific RPC or we use the postgrest API to query information_schema if enabled.
    // However, usually information_schema is not exposed to anon.

    // Instead, let's try to select * from optionvalues limit 1 and see the returned keys, 
    // OR we can rely on the error message which already told us `option_group_id` is missing.

    // Let's try to infer from `optiongroups` relationship if possible, or just list all data.

    console.log("Checking columns by selecting one row...");
    const { data, error } = await supabase.from('optionvalues').select('*').limit(1);

    if (error) {
        console.error('Error selecting:', error);
    } else {
        if (data.length > 0) {
            console.log('Columns found in first row:', Object.keys(data[0]));
        } else {
            console.log('Table is empty, cannot infer columns from data.');
            // Fallback: try to insert a dummy row with option_group_id and see error? No, that's what user did.
        }
    }

    // Checking if there is a `group_id` column instead
    const { data: data2, error: error2 } = await supabase.from('optionvalues').select('group_id').limit(1);
    if (!error2) {
        console.log("Column 'group_id' EXISTS.");
    } else {
        console.log("Column 'group_id' check failed:", error2.message);
    }
}

checkSchema();
