require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

// 1. SETUP FOR LOCALHOST
// Note: Usually Studio is 54323, API is 54321.
const localUrl = 'http://127.0.0.1:54321';

// Try to grab local keys from ENV, or fallback to standard Supabase CLI Local Dev Keys
const localServiceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ||
    process.env.VITE_LOCAL_SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY; // Dangerous fallback if identical

const localAnonKey = process.env.VITE_LOCAL_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

if (!localServiceKey) {
    console.warn('⚠️ No specific LOCAL Service Key found. Trying with Anon Key (might fail RLS if not Admin)...');
}

// Create client pointing to LOCALHOST
const supabase = createClient(localUrl, localServiceKey || localAnonKey);

async function run() {
    console.log(`🚀 Connecting to LOCAL Database at ${localUrl}...`);

    const targetIds = [354, 355, 356, 357];
    const targetStock = 3000;

    for (const id of targetIds) {
        console.log(`\n👉 Processing Local Item ID: ${id}`);

        // 1. Check if item exists locally
        const { data: item, error: fetchError } = await supabase.from('inventory_items').select('id, name, current_stock').eq('id', id).single();

        if (fetchError) {
            console.error(`❌ Local connection failed or Item not found:`, fetchError.message);
            if (fetchError.message.includes('fetch failed')) {
                console.error('🔥 FATAL: Cannot connect to Local Supabase API (Port 54321). Is Docker running?');
                return; // Stop script
            }
            continue;
        }

        console.log(`   Found Local: "${item.name}". Stock: ${item.current_stock}`);

        // 2. Perform Update via RPC
        const { data, error: updateError } = await supabase.rpc('update_inventory_stock', {
            p_item_id: id,
            p_new_stock: targetStock,
            p_counted_by: null,
            p_source: 'local_script_override'
        });

        if (updateError) {
            console.error(`❌ Update FAILED for ${id}:`, updateError.message);
        } else {
            console.log(`   ✅ Local Update sent via RPC.`);

            // 3. Verify
            const { data: verify } = await supabase.from('inventory_items').select('current_stock').eq('id', id).single();
            if (verify && verify.current_stock === targetStock) {
                console.log(`   🎉 CONFIRMED: Local Database now holds value ${verify.current_stock}.`);
            }
        }
    }
}

run();
