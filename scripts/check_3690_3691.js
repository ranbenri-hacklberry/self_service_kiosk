
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkOrders() {
    const businessId = '22222222-2222-2222-2222-222222222222';

    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id, 
            order_number, 
            order_status, 
            created_at, 
            order_items (
                id, 
                item_status, 
                menu_items (name, kds_routing_logic, inventory_settings)
            )
        `)
        .eq('business_id', businessId)
        .in('order_number', [3690, 3691]);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(JSON.stringify(orders, null, 2));
}

checkOrders();
