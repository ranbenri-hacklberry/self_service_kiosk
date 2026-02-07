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

async function forceCompleteAllViaRPC() {
    console.log('🚀 STARTING RPC-BASED FORCE COMPLETION 🚀');
    console.log(`Target Business: ${BUSINESS_ID}`);

    try {
        // 1. Fetch Candidates (Any active status)
        const statuses = ['in_progress', 'ready', 'pending', 'new', 'held'];

        let allProcessed = 0;
        let hasMore = true;

        while (hasMore) {
            const { data: orders, error: fetchErr } = await supabase
                .from('orders')
                .select('id, order_number')
                .eq('business_id', BUSINESS_ID)
                .in('order_status', statuses)
                .limit(200); // Smaller batch for RPC calls

            if (fetchErr) throw fetchErr;

            if (!orders || orders.length === 0) {
                console.log('✅ No more active orders found.');
                hasMore = false;
                break;
            }

            console.log(`📦 Found batch of ${orders.length} orders. Updating via RPC...`);

            // 2. Update via RPC loop (Parallelized for speed)
            const updates = orders.map(async (o) => {
                const { error } = await supabase.rpc('update_order_status_v3', {
                    p_order_id: o.id,
                    p_new_status: 'completed',
                    p_business_id: BUSINESS_ID
                });
                if (error) return { id: o.id, status: 'failed', msg: error.message };
                return { id: o.id, status: 'success' };
            });

            const results = await Promise.all(updates);
            const failures = results.filter(r => r.status === 'failed');

            if (failures.length > 0) {
                console.error(`⚠️ Failed to update ${failures.length} orders. Sample error: ${failures[0].msg}`);
            }

            allProcessed += (results.length - failures.length);
            console.log(`✅ Batch processed. Success: ${results.length - failures.length}, Fails: ${failures.length}`);

            if (orders.length < 200) hasMore = false;
        }

        console.log(`🎉 FINAL RESULT: Successfully moved ${allProcessed} orders to COMPLETED via RPC.`);

    } catch (err) {
        console.error('❌ Script failed:', err.message);
    }
}

forceCompleteAllViaRPC();
