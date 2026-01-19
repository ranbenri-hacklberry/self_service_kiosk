import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function compareItems() {
    try {
        console.log('--- Comparing Inventory Items ---');

        const { data: items, error } = await supabase
            .from('inventory_items')
            .select('*')
            .or('name.ilike.%חלב פרה%,name.ilike.%אננס קפוא%');

        if (error) throw error;

        if (!items || items.length === 0) {
            console.log('No items found with those names.');
            return;
        }

        items.forEach(item => {
            console.log(`\nItem: ${item.name} (ID: ${item.id})`);
            console.log(`- Unit: ${item.unit}`);
            console.log(`- Count Step: ${item.count_step}`);
            console.log(`- Weight per Unit: ${item.weight_per_unit}`);
            console.log(`- Min Order: ${item.min_order}`);
            console.log(`- Order Step: ${item.order_step}`);
            console.log(`- Current Stock: ${item.current_stock}`);
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

compareItems();
