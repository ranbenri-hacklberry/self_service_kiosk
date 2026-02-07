import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; // Must use Service Key for massive updates
const BUSINESS_ID = '11111111-1111-1111-1111-111111111111';

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fixOrderHistory() {
    console.log('🚧 Starting Bulk Order Completion Script...');
    console.log(`Target Business: ${BUSINESS_ID}`);

    // SAFETY: Don't complete orders from the last 2 hours
    const safeZone = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    console.log(`🛡️ Safety: Only completing orders created before ${safeZone}`);

    try {
        // 1. Fetch Candidates (Cloud)
        // We fetch ALL in_progress/ready/pending orders older than safeZone
        const { data: orders, error: fetchErr } = await supabase
            .from('orders')
            .select('id, order_number, order_status, created_at')
            .eq('business_id', BUSINESS_ID)
            .in('order_status', ['in_progress', 'ready', 'pending', 'new'])
            .lt('created_at', safeZone)
            .limit(5000); // Batch size

        if (fetchErr) throw fetchErr;

        if (!orders || orders.length === 0) {
            console.log('✅ No stale orders found to complete.');
            return;
        }

        console.log(`📦 Found ${orders.length} stale orders. Processing...`);

        const orderIds = orders.map(o => o.id);

        // 2. Perform Bulk Update on Orders
        const { error: updateOrderErr } = await supabase
            .from('orders')
            .update({
                order_status: 'completed',
                completed_at: new Date().toISOString(), // Mark completion time
                updated_at: new Date().toISOString()
            })
            .in('id', orderIds);

        if (updateOrderErr) throw updateOrderErr;
        console.log(`✅ Updated ${orders.length} orders to 'completed'.`);

        // 3. Perform Bulk Update on Items (Cascade)
        // Set all non-cancelled items of these orders to completed
        const { error: updateItemsErr } = await supabase
            .from('order_items')
            .update({
                item_status: 'completed',
                updated_at: new Date().toISOString()
            })
            .in('order_id', orderIds)
            .neq('item_status', 'cancelled');

        if (updateItemsErr) throw updateItemsErr;
        console.log(`✅ Updated items for ${orders.length} orders to 'completed'.`);

        console.log('🎉 History fix complete!');

    } catch (err) {
        console.error('❌ Script failed:', err.message);
    }
}

fixOrderHistory();
