
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function formatDateTime(isoString) {
    if (!isoString) return '---';
    return new Date(isoString).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
}

async function checkLatestOrder() {
    console.log('Fetching latest order...');

    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, 
            order_number, 
            customer_name, 
            total_amount, 
            created_at,
            order_items (
                id, menu_items(name), quantity
            )
        `)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.log('Error fetching order:', error.message);
        return;
    }

    if (data && data.length > 0) {
        const order = data[0];
        console.log('✅ Latest Order Found in DB!');
        console.log(`🆔 ID: ${order.id}`);
        console.log(`🔢 Number: ${order.order_number}`);
        console.log(`👤 Customer: ${order.customer_name}`);
        console.log(`💰 Total: ${order.total_amount}`);
        console.log(`📅 Created At: ${await formatDateTime(order.created_at)}`);
        console.log('📦 Items:');
        order.order_items.forEach(item => {
            console.log(`   - ${item.quantity}x ${item.menu_items?.name || 'Unknown Item'}`);
        });
    } else {
        console.log('❌ No orders found in DB.');
    }
}

checkLatestOrder().catch(console.error);
