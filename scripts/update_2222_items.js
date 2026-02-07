
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const businessId = '22222222-2222-2222-2222-222222222222';
    console.log(`🔍 Checking business ${businessId} (iCaffe)...`);

    const { data: items, error } = await supabase
        .from('menu_items')
        .select('id, name, inventory_settings, kds_routing_logic')
        .eq('business_id', businessId);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (!items || items.length === 0) {
        console.log(`⚠️ No items found for business ${businessId}. checking 222...`);
        const { data: items222 } = await supabase
            .from('menu_items')
            .select('id, name')
            .eq('business_id', '222');
        console.log(`Found ${items222?.length || 0} items for 222.`);
        return;
    }

    console.log(`🚀 Updating ${items.length} items for business ${businessId}...`);

    for (const item of items) {
        // Update to 'requires_prep' and ensure KDS visibility
        const newSettings = {
            ...(item.inventory_settings || {}),
            preparationMode: 'requires_prep'
        };

        const { error: updateErr } = await supabase
            .from('menu_items')
            .update({
                inventory_settings: newSettings,
                kds_routing_logic: 'MADE_TO_ORDER' // Ensuring it goes to KDS
            })
            .eq('id', item.id);

        if (updateErr) {
            console.error(`❌ Failed to update ${item.name}:`, updateErr.message);
        } else {
            console.log(`✅ Updated ${item.name}`);
        }
    }
}

run();
