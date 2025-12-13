// Simple fetch-based Supabase inspector
const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

async function query(table, select = '*', limit = 1) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    return response.json();
}

async function inspect() {
    console.log('\n=== 📊 SUPABASE SCHEMA INSPECTION ===\n');

    // 1. Orders
    console.log('1️⃣ ORDERS TABLE:');
    const orders = await query('orders', '*', 1);
    if (orders && orders.length > 0) {
        console.log('   Columns:', Object.keys(orders[0]));
        console.log('   Sample:', JSON.stringify(orders[0], null, 2));
    }

    // 2. Order Items
    console.log('\n2️⃣ ORDER_ITEMS TABLE:');
    const orderItems = await query('order_items', '*', 1);
    if (orderItems && orderItems.length > 0) {
        console.log('   Columns:', Object.keys(orderItems[0]));
        console.log('   Sample:', JSON.stringify(orderItems[0], null, 2));
    }

    // 3. Option Groups
    console.log('\n3️⃣ OPTIONGROUPS TABLE:');
    const optionGroups = await query('optiongroups', '*', 3);
    if (optionGroups && optionGroups.length > 0) {
        console.log('   Columns:', Object.keys(optionGroups[0]));
        console.log('   Samples:', optionGroups.map(g => ({ id: g.id, name: g.name })));
    }

    // 4. Option Values
    console.log('\n4️⃣ OPTIONVALUES TABLE:');
    const optionValues = await query('optionvalues', '*', 5);
    if (optionValues && optionValues.length > 0) {
        console.log('   Columns:', Object.keys(optionValues[0]));
        console.log('   Samples:', optionValues.map(v => ({
            id: v.id,
            value_name: v.value_name,
            group_id: v.group_id
        })));
    }

    // 5. Menu Item Options
    console.log('\n5️⃣ MENUITEMOPTIONS TABLE:');
    const menuItemOptions = await query('menuitemoptions', '*', 3);
    if (menuItemOptions && menuItemOptions.length > 0) {
        console.log('   Columns:', Object.keys(menuItemOptions[0]));
        console.log('   Samples:', menuItemOptions);
    }

    // 6. Full order with nested data
    console.log('\n6️⃣ LATEST ORDER WITH ITEMS:');
    const fullOrder = await query('orders', 'id,order_number,customer_name,order_items(id,quantity,mods,menu_item_id)', 1);
    if (fullOrder && fullOrder.length > 0) {
        console.log('   Full Order:', JSON.stringify(fullOrder[0], null, 2));
    }

    console.log('\n=== ✅ INSPECTION COMPLETE ===\n');
}

inspect().catch(console.error);
