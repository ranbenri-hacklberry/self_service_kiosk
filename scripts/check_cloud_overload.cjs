require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_ROLE_KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY || ''; // This might be local only

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCloudFunctions() {
    console.log('🔍 Checking cloud functions for overloading...');

    // Use run_sql to check functions
    const query = `
    SELECT 
        n.nspname as schema,
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'update_order_status_v3'
    AND n.nspname = 'public'
  `;

    const { data, error } = await supabase.rpc('run_sql', { query_text: query });

    if (error) {
        console.error('❌ Error checking cloud functions:', error);
        // If run_sql fails, it might be due to permissions (service_role only)
        return;
    }

    console.log('Result:', JSON.stringify(data, null, 2));
}

checkCloudFunctions();
