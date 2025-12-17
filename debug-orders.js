
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('Fetching orders since:', today.toISOString());

    const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, order_status, business_id')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Orders found:', data.length);
        console.table(data);
    }
}

checkOrders();
