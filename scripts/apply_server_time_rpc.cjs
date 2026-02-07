const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY; // Prefer service key if available

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260202140000_add_server_time.sql');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

async function run() {
    console.log('Applying migration:', sqlPath);
    const { data, error } = await supabase.rpc('run_sql', { query_text: sqlContent });

    if (error) {
        console.error('Error applying migration:', error);
    } else {
        console.log('Migration applied successfully:', data);
    }
}

run();
