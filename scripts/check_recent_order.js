
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkRecentOrder() {
    const businessId = '22222222-2222-2222-2222-222222222222';

    // 1. Get most recent order
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select(`
            id, 
            order_number, 
            order_status, 
            created_at, 
            order_items (
                id, 
                menu_item_id, 
                item_status, 
                menu_items (name, kds_routing_logic, inventory_settings)
            )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (orderError) {
        console.error('Error fetching order:', orderError);
        return;
    }

    console.log('--- RECENT ORDER DIAGNOSTICS ---');
    console.log(JSON.stringify(orders[0], null, 2));

    // 2. Check "אמריקנו קר" specifically
    const { data: item } = await supabase
        .from('menu_items')
        .select('id, name, kds_routing_logic, inventory_settings')
        .eq('business_id', businessId)
        .eq('name', 'אמריקנו קר')
        .single();

    console.log('\n--- ITEM SETTINGS: אמריקנו קר ---');
    console.log(JSON.stringify(item, null, 2));
}

checkRecentOrder();
