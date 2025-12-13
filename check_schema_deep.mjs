
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchemaDetailed() {
    console.log('Checking menu_items columns...');

    // We can't access information_schema columns with anon key usually, but let's try.
    // If that fails, we infer from a known query that selects specific columns.

    // Test if is_hot_drink exists
    const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, is_hot_drink')
        .limit(1);

    if (error) {
        console.log('Error selecting is_hot_drink:', error.message);
    } else {
        console.log('Successfully selected is_hot_drink. Column exists.');
        console.log('Value:', data[0]);
    }

    console.log('\nChecking submit_order_v2 with items...');

    // Find a valid item ID first
    const { data: menuItems } = await supabase.from('menu_items').select('id').limit(1);

    if (!menuItems || menuItems.length === 0) {
        console.log('No menu items found to test order with.');
        return;
    }

    const itemId = menuItems[0].id;
    console.log('Using item ID:', itemId);

    const itemPayload = {
        item_id: itemId,
        quantity: 1,
        price: 10,
        mods: [],
        notes: 'Test',
        course_stage: 1
    };

    const orderPayload = {
        p_customer_phone: '0501234567',
        p_customer_name: 'Schema Test',
        p_items: [itemPayload],
        p_is_paid: false,
        p_final_total: 10
    };

    const { data: orderData, error: orderError } = await supabase.rpc('submit_order_v2', orderPayload);

    if (orderError) {
        console.log('Error creating order with item:');
        console.log(orderError);
    } else {
        console.log('Success creating order with item:', orderData);
    }
}

checkSchemaDetailed().catch(console.error);
