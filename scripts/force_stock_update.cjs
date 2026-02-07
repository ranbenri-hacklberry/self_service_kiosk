require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('🚀 Starting DIRECT STOCK INJECTION for items: 354, 355, 356, 357...');

    const targetIds = [354, 355, 356, 357];
    const targetStock = 3000;

    for (const id of targetIds) {
        console.log(`\n👉 Processing Item ID: ${id}`);

        // 1. Check existence
        const { data: item, error: fetchError } = await supabase.from('inventory_items').select('id, name, current_stock').eq('id', id).single();

        if (fetchError || !item) {
            console.error(`❌ Item ${id} NOT FOUND! Cannot update.`);
            continue;
        }

        console.log(`   Found: "${item.name}". Current Stock: ${item.current_stock}`);

        // 2. Perform Update via RPC (The one we know works with Service Role)
        const { data, error: updateError } = await supabase.rpc('update_inventory_stock', {
            p_item_id: id,
            p_new_stock: targetStock,
            p_counted_by: null,
            p_source: 'manual_override_script'
        });

        if (updateError) {
            console.error(`❌ Update FAILED for ${id}:`, updateError.message);
        } else {
            console.log(`   ✅ Update sent via RPC.`);

            // 3. IMMEDIATE VERIFICATION
            const { data: verify, error: verifyError } = await supabase.from('inventory_items').select('current_stock').eq('id', id).single();

            if (verify && verify.current_stock === targetStock) {
                console.log(`   🎉 CONFIRMED: Database now holds value ${verify.current_stock}.`);
            } else {
                console.error(`   ⚠️ VERIFICATION FAILED! DB holds ${verify?.current_stock}, expected ${targetStock}`);
            }
        }
    }
}

run();
