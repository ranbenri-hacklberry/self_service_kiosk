import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
    console.log('\n=== 📊 INSPECTING SUPABASE SCHEMA ===\n');

    // 1. Check orders table structure
    console.log('1️⃣ ORDERS TABLE:');
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (ordersError) {
        console.error('❌ Error fetching orders:', ordersError);
    } else if (orders && orders.length > 0) {
        console.log('   Columns:', Object.keys(orders[0]));
        console.log('   Sample:', orders[0]);
    } else {
        console.log('   ⚠️ No orders found');
    }

    // 2. Check order_items table structure
    console.log('\n2️⃣ ORDER_ITEMS TABLE:');
    const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .limit(1);

    if (itemsError) {
        console.error('❌ Error fetching order_items:', itemsError);
    } else if (orderItems && orderItems.length > 0) {
        console.log('   Columns:', Object.keys(orderItems[0]));
        console.log('   Sample:', orderItems[0]);
    } else {
        console.log('   ⚠️ No order_items found');
    }

    // 3. Check option groups table
    console.log('\n3️⃣ OPTIONGROUPS TABLE:');
    const { data: optionGroups, error: groupsError } = await supabase
        .from('optiongroups')
        .select('*')
        .limit(3);

    if (groupsError) {
        console.error('❌ Error fetching optiongroups:', groupsError);
    } else if (optionGroups && optionGroups.length > 0) {
        console.log('   Columns:', Object.keys(optionGroups[0]));
        console.log('   Sample groups:', optionGroups.map(g => ({ id: g.id, name: g.name })));
    } else {
        console.log('   ⚠️ No option groups found');
    }

    // 4. Check option values table
    console.log('\n4️⃣ OPTIONVALUES TABLE:');
    const { data: optionValues, error: valuesError } = await supabase
        .from('optionvalues')
        .select('*')
        .limit(5);

    if (valuesError) {
        console.error('❌ Error fetching optionvalues:', valuesError);
    } else if (optionValues && optionValues.length > 0) {
        console.log('   Columns:', Object.keys(optionValues[0]));
        console.log('   Sample values:', optionValues.map(v => ({
            id: v.id,
            value_name: v.value_name,
            group_id: v.group_id,
            price_adjustment: v.price_adjustment
        })));
    } else {
        console.log('   ⚠️ No option values found');
    }

    // 5. Check menu item options linking table
    console.log('\n5️⃣ MENUITEMOPTIONS TABLE:');
    const { data: menuItemOptions, error: linkError } = await supabase
        .from('menuitemoptions')
        .select('*')
        .limit(3);

    if (linkError) {
        console.error('❌ Error fetching menuitemoptions:', linkError);
    } else if (menuItemOptions && menuItemOptions.length > 0) {
        console.log('   Columns:', Object.keys(menuItemOptions[0]));
        console.log('   Sample links:', menuItemOptions);
    } else {
        console.log('   ⚠️ No menu item options found');
    }

    // 6. Check a full order with items and their mods
    console.log('\n6️⃣ FULL ORDER WITH ITEMS:');
    const { data: fullOrder, error: fullError } = await supabase
        .from('orders')
        .select(`
      id,
      order_number,
      customer_name,
      order_items (
        id,
        quantity,
        mods,
        menu_item_id,
        menu_items (
          name
        )
      )
    `)
        .limit(1)
        .order('created_at', { ascending: false });

    if (fullError) {
        console.error('❌ Error fetching full order:', fullError);
    } else if (fullOrder && fullOrder.length > 0) {
        console.log('   Order:', {
            id: fullOrder[0].id,
            order_number: fullOrder[0].order_number,
            customer_name: fullOrder[0].customer_name,
            items: fullOrder[0].order_items
        });
    } else {
        console.log('   ⚠️ No orders found');
    }

    console.log('\n=== ✅ SCHEMA INSPECTION COMPLETE ===\n');
}

inspectSchema().catch(console.error);
