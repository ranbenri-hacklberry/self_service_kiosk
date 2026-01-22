const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- GLOBAL DB Check ---');

    const { count, error: countErr } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

    if (countErr) {
        console.error('Count error:', countErr.message);
    } else {
        console.log(`Total orders in table: ${count}`);
    }

    const { data: latest, error: lateErr } = await supabase
        .from('orders')
        .select('*, businesses(name)')
        .order('created_at', { ascending: false })
        .limit(5);

    if (lateErr) {
        console.error('Fetch error:', lateErr.message);
    } else {
        console.log('Last 5 orders (any business):');
        latest.forEach(o => {
            console.log(`[${o.created_at}] Order #${o.order_number} (Business: ${o.businesses?.name || o.business_id}): Status=${o.order_status}`);
        });
    }
}

check();
