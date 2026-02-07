require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('🚀 Checking Existing RPC: "update_inventory_stock"...');

    // 1. Fetch Item
    const { data: items } = await supabase.from('inventory_items').select('id, name, current_stock').limit(1);
    if (!items || items.length === 0) {
        console.log('⚠️ No items found generally.');
        return;
    }
    const item = items[0];
    const oldStock = item.current_stock;
    const newStock = parseFloat((oldStock + 0.5).toFixed(2));

    console.log(`🎯 Target: ${item.name} (ID: ${item.id}). Stock: ${oldStock} -> ${newStock}`);

    // 2. Call the REAL EXISTING function found in iPad code
    // Signature from code: (p_item_id, p_new_stock, p_counted_by, p_source)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('update_inventory_stock', {
        p_item_id: item.id,
        p_new_stock: newStock,
        p_counted_by: null,
        p_source: 'script_test_existing_rpc'
    });

    if (rpcError) {
        console.error('❌ RPC Call Failed:', rpcError);
    } else {
        console.log('✅ RPC SUCCESS! Result:', rpcResult);

        // 3. Verification Check
        const { data: check } = await supabase.from('inventory_items').select('current_stock').eq('id', item.id).single();
        if (check.current_stock === newStock) {
            console.log('🎉 VERIFIED: Database updated successfully via existing function.');
            // Revert
            await supabase.rpc('update_inventory_stock', {
                p_item_id: item.id,
                p_new_stock: oldStock,
                p_counted_by: null,
                p_source: 'script_revert'
            });
            console.log('♻️ Reverted test change.');
        } else {
            console.error('⚠️ RPC returned success but DB value did not change!', check);
        }
    }
}

run();
