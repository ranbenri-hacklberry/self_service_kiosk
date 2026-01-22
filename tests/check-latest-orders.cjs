const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- DB Check ---');

    // 1. Get Business ID
    const { data: userData } = await supabase.rpc('authenticate_employee', {
        p_email: 'ran@mail.com',
        p_password: '1234'
    });

    if (!userData || userData.length === 0) {
        console.error('Failed to get business ID');
        return;
    }

    const businessId = userData[0].business_id;
    console.log(`Business Name: ${userData[0].business_name}`);
    console.log(`Business ID: ${businessId}`);

    // 2. Check latest orders
    const { data: latestOrders, error } = await supabase
        .from('orders')
        .select('id, order_number, order_status, created_at, total_amount')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching orders:', error.message);
        return;
    }

    if (latestOrders.length === 0) {
        console.log('No orders found for this business.');
    } else {
        console.log(`Found ${latestOrders.length} recent orders:`);
        latestOrders.forEach(o => {
            console.log(`[${o.created_at}] Order #${o.order_number}: Status=${o.order_status}, Total=${o.total_amount}`);
        });
    }
}

check();
