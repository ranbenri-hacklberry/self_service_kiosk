const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- RPC DB Check ---');

    // Use the diagnostic RPC which is likely security definer
    const { data: orders, error } = await supabase.rpc('get_diagnostic_order', {
        p_order_id: '5bd7b0a9-50f3-47c9-93e2-ab68d45761ae' // The ID from previous test
    });

    if (error) {
        console.error('Error fetching by ID:', error.message);
    } else {
        console.log('Order found by ID:', orders);
    }
}

check();
