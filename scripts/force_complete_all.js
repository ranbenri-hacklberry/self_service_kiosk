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

async function forceCompleteAll() {
    console.log('☢️ STARTING FORCE COMPLETION OF ALL ACTIVE ORDERS ☢️');
    console.log(`Target Business: ${BUSINESS_ID}`);
    console.log('User instruction: "Move every order in progress to completed. Everything is closed."');

    try {
        // 1. Fetch Candidates (Any active status)
        // We do NOT apply a time filter this time.
        const statuses = ['in_progress', 'ready', 'pending', 'new', 'held'];

        // Loop to handle batches if more than 1000
        let allProcessed = 0;
        let hasMore = true;

        while (hasMore) {
            const { data: orders, error: fetchErr } = await supabase
                .from('orders')
                .select('id, order_number, order_status')
                .eq('business_id', BUSINESS_ID)
                .in('order_status', statuses)
                .limit(1000);

            if (fetchErr) throw fetchErr;

            if (!orders || orders.length === 0) {
                console.log('✅ No more active orders found.');
                hasMore = false;
                break;
            }

            console.log(`📦 Found batch of ${orders.length} active orders... completing them.`);
            const orderIds = orders.map(o => o.id);

            // 2. Update Orders
            const { error: updateOrderErr } = await supabase
                .from('orders')
                .update({
                    order_status: 'completed',
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .in('id', orderIds);

            if (updateOrderErr) throw updateOrderErr;

            // 3. Update Items (Cascade)
            const { error: updateItemsErr } = await supabase
                .from('order_items')
                .update({
                    item_status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .in('order_id', orderIds)
                .neq('item_status', 'cancelled'); // Preserve cancellations

            if (updateItemsErr) throw updateItemsErr;

            allProcessed += orders.length;
            console.log(`✅ Batch complete. Total so far: ${allProcessed}`);

            // Safety break for infinite loops if updates fail silently (though error thrown above)
            if (orders.length < 1000) hasMore = false;
        }

        console.log(`🎉 FINAL RESULT: Successfully moved ${allProcessed} orders to COMPLETED.`);

    } catch (err) {
        console.error('❌ Script failed:', err.message);
    }
}

forceCompleteAll();
