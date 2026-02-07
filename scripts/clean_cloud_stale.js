import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const BUSINESS_ID = '11111111-1111-1111-1111-111111111111';

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function cleanStaleCloudOrders() {
    console.log('🧹 Starting Cloud Stale Order Cleanup...');
    console.log(`Target Business: ${BUSINESS_ID}`);

    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
    console.log(`Cutoff Time: ${cutoffTime}`);

    try {
        // 1. Find Stale Orders
        const { data: staleOrders, error: findError } = await supabase
            .from('orders')
            .select('id, created_at, order_status')
            .eq('business_id', BUSINESS_ID)
            .in('order_status', ['new', 'pending', 'in_progress', 'ready', 'held'])
            .lt('created_at', cutoffTime)
            .limit(1000);

        if (findError) throw findError;

        if (!staleOrders || staleOrders.length === 0) {
            console.log('✅ No stale orders found in Cloud.');
            return;
        }

        console.log(`⚠️ Found ${staleOrders.length} stale orders in Cloud. Archiving...`);

        const staleIds = staleOrders.map(o => o.id);

        // 2. Archive Orders (Set to completed)
        const { error: updateOrdersError } = await supabase
            .from('orders')
            .update({
                order_status: 'completed',
                updated_at: new Date().toISOString()
            })
            .in('id', staleIds);

        if (updateOrdersError) throw updateOrdersError;
        console.log('✅ Archived orders successfully.');

        // 3. Archive Items
        const { error: updateItemsError } = await supabase
            .from('order_items')
            .update({ item_status: 'completed' })
            .in('order_id', staleIds)
            .neq('item_status', 'cancelled'); // Don't un-cancel items

        if (updateItemsError) throw updateItemsError;
        console.log('✅ Archived order items successfully.');

    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
    }
}

cleanStaleCloudOrders();
