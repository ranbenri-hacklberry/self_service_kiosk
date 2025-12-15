
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkOrder() {
    console.log('\n=== 🔍 CHECKING ORDER 191 ===\n');

    const { data: order, error } = await supabase
        .from('orders')
        .select('order_number, order_status, created_at, ready_at, completed_at')
        .eq('order_number', 191)
        .single();

    if (error) {
        console.error('❌ Error fetching order:', error);
    } else if (order) {
        console.log('✅ Order Found:');
        console.table(order);

        if (order.ready_at) {
            const created = new Date(order.created_at);
            const ready = new Date(order.ready_at);
            const diff = (ready - created) / 1000 / 60;
            console.log(`\n⏱️  Prep time: ${diff.toFixed(2)} minutes`);
        } else {
            console.log('\n⚠️  No ready_at timestamp');
        }

        if (order.completed_at && order.ready_at) {
            const ready = new Date(order.ready_at);
            const completed = new Date(order.completed_at);
            const diff = (completed - ready) / 1000 / 60;
            console.log(`⏱️  Pickup time: ${diff.toFixed(2)} minutes`);
        } else if (order.completed_at) {
            console.log('\n⚠️  Has completed_at but missing ready_at for calc');
        } else {
            console.log('⚠️  No completed_at timestamp');
        }

    } else {
        console.log('❌ Order 191 not found');
    }
}

checkOrder().catch(console.error);
