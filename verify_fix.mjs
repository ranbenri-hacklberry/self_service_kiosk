// Check if the RPC fix worked
const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

async function query(table, select = '*', filter = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filter}&order=created_at.desc&limit=1`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    return response.json();
}

async function checkLatestOrder() {
    console.log('\n=== 🔍 CHECKING LATEST ORDER (AFTER RPC FIX) ===\n');

    // Get latest order
    const orders = await query('orders', 'id,order_number,customer_name,order_status,created_at');

    if (orders && orders.length > 0) {
        const order = orders[0];
        console.log('📋 Latest Order:');
        console.log(`   ID: ${order.id}`);
        console.log(`   Order Number: ${order.order_number} ${order.order_number ? '✅' : '❌'}`);
        console.log(`   Customer: ${order.customer_name}`);
        console.log(`   Status: ${order.order_status}`);
        console.log(`   Created: ${order.created_at}`);

        // Get order items
        const items = await query('order_items', 'id,menu_item_id,quantity,mods', `&order_id=eq.${order.id}`);

        console.log(`\n📦 Order Items: ${items.length} ${items.length > 0 ? '✅' : '❌'}`);
        if (items && items.length > 0) {
            items.forEach((item, idx) => {
                console.log(`\n   Item ${idx + 1}:`);
                console.log(`     - menu_item_id: ${item.menu_item_id} ${item.menu_item_id ? '✅' : '❌'}`);
                console.log(`     - quantity: ${item.quantity}`);
                console.log(`     - mods: ${item.mods ? JSON.stringify(item.mods).substring(0, 100) : 'null'} ${item.mods ? '✅' : '⚠️'}`);
            });
        }

        // Get full order with menu items for KDS display
        console.log('\n🖥️  KDS VIEW TEST:');
        const kdsOrder = await query('orders',
            'id,order_number,customer_name,order_items(quantity,menu_items(name))',
            `&id=eq.${order.id}`
        );

        if (kdsOrder && kdsOrder.length > 0) {
            console.log('   KDS Data:', JSON.stringify(kdsOrder[0], null, 2));
        }

    } else {
        console.log('❌ No orders found!');
    }

    console.log('\n=== ✅ CHECK COMPLETE ===\n');
}

checkLatestOrder().catch(console.error);
