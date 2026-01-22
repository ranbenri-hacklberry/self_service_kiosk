const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testSubmit() {
    console.log('--- Testing submit_order_v3 ---');

    // 1. Get menu item for iCaffe
    const businessId = '22222222-2222-2222-2222-222222222222';
    const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('business_id', businessId)
        .limit(1);

    if (!items || items.length === 0) {
        console.error('No items for iCaffe');
        return;
    }
    const item = items[0];
    console.log(`Using item: ${item.name} (${item.id})`);

    // 2. Try to submit
    const { data, error } = await supabase.rpc('submit_order_v3', {
        p_business_id: businessId,
        p_final_total: item.price,
        p_order_type: 'dine_in',
        p_payment_method: 'cash',
        p_customer_name: 'DEBUG TEST',
        p_customer_phone: '0540000000',
        p_items: [
            {
                item_id: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
                kds_routing_logic: 'MADE_TO_ORDER',
                item_status: 'in_progress'
            }
        ]
    });

    if (error) {
        console.error('RPC Error:', error.message);
        console.error('Details:', error.details);
    } else {
        console.log('RPC Success!', data);
    }
}

testSubmit();
