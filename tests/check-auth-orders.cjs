const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- Auth Check ---');
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'ran@mail.com',
        password: '1234'
    });

    if (authErr) {
        console.error('Auth Error:', authErr.message);
        return;
    }
    console.log('Logged in as:', auth.user.email);

    const businessId = '22222222-2222-2222-2222-222222222222';
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Fetch error:', error.message);
    } else {
        console.log(`Found ${orders.length} orders for iCaffe:`);
        orders.forEach(o => {
            console.log(`[${o.created_at}] Order #${o.order_number}: Status=${o.order_status}, Name=${o.customer_name}`);
        });
    }
}

check();
