
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDemoSchema() {
    console.log('Checking demo.menu_items columns...');

    // Attempt to select from demo schema.
    // NOTE: This might fail if the anon key doesn't have access to the demo schema directly via the client without proper RLS or explicit grant.
    // The setup_demo_environment.sql DID grant usage to anon, so it might work.

    try {
        // Supabase-js client usually defaults to "public" schema. 
        // We can specify schema in the constructor options, but to switch on the fly is harder.
        // We can try to use .rpc to inspect or just try a raw query if we had a sql tool.
        // Since we don't, we'll try to use the client with schema option.
    } catch (e) {
        console.error(e);
    }
}

// Create a new client specifically for the 'demo' schema to test existence
const demoSupabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'demo' } });

async function runCheck() {
    console.log('--- Checking PUBLIC schema (again) ---');
    const { data: publicData, error: publicError } = await supabase
        .from('menu_items')
        .select('is_hot_drink')
        .limit(1);

    if (publicError) console.log('Public Schema Error:', publicError.message);
    else console.log('Public Schema Success:', publicData);

    console.log('\n--- Checking DEMO schema ---');
    const { data: demoData, error: demoError } = await demoSupabase
        .from('menu_items')
        .select('is_hot_drink')
        .limit(1);

    if (demoError) console.log('Demo Schema Error:', demoError.message);
    else console.log('Demo Schema Success:', demoData);
}

runCheck().catch(console.error);
