import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const PILOT_ID = '11111111-1111-1111-1111-111111111111';

async function investigate() {
    console.log('🕵️ Investigating recent status changes for Pilot business...');

    // Find orders updated in the last 30 minutes
    const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: recentUpdates, error: err } = await supabase
        .from('orders')
        .select('id, order_number, order_status, updated_at, created_at')
        .eq('business_id', PILOT_ID)
        .gt('updated_at', halfHourAgo)
        .order('updated_at', { ascending: false });

    if (err) {
        console.error('❌ Error:', err.message);
    } else {
        console.log(`📊 Found ${recentUpdates.length} orders updated in the last 30m:`);
        recentUpdates.forEach(o => {
            console.log(`- #${o.order_number}: Status=${o.order_status}, Updated=${o.updated_at}`);
        });
    }

    // Check if there are any 'ready' or 'in_progress' orders at all
    const { data: active, error: err2 } = await supabase
        .from('orders')
        .select('id, order_number, order_status')
        .eq('business_id', PILOT_ID)
        .in('order_status', ['new', 'pending', 'in_progress', 'ready'])
        .limit(10);

    if (!err2) {
        console.log(`🟢 Active orders currently showing (Total: ${active.length}):`);
        active.forEach(o => console.log(`- #${o.order_number}: ${o.order_status}`));
    }
}

investigate();
