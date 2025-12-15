
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkRpc() {
    console.log('Checking submit_order_v2 signature...');

    // Attempt to call with empty object to provoke an error detailing the expected signature
    const { data, error } = await supabase.rpc('submit_order_v2', {});

    if (error) {
        console.log('Error calling with empty args (Expected):');
        console.log(error);
        if (error.hint) console.log('Hint:', error.hint);
        if (error.message) console.log('Message:', error.message);
    } else {
        console.log('Surprisingly, it worked with empty args:', data);
    }

    // Try to call with the "old" signature (without the new params I suspect might be missing)
    // Old signature based on what I might guess if I didn't see the file. 
    // But actually, let's try to call it with the NEW params set to null/default to see if it accepts them.
    // If the DB version is OLD, it will complain about "unknown argument: p_is_quick_order"

    const testPayload = {
        p_customer_phone: '0500000000',
        p_customer_name: 'Test',
        p_items: [],
        p_is_paid: false,
        // New params:
        p_original_coffee_count: 0,
        p_is_quick_order: false
    };

    console.log('\nTesting with NEW params included...');
    const { data: data2, error: error2 } = await supabase.rpc('submit_order_v2', testPayload);

    if (error2) {
        console.log('Error calling with NEW params:');
        console.log(error2.message);
        if (error2.details) console.log('Details:', error2.details);
    } else {
        console.log('Success calling with NEW params! The DB has the new version.');
    }
}

checkRpc().catch(console.error);
