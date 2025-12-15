
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventorySchema() {
    const tables = ['suppliers', 'inventory_items', 'ingredients', 'product_ingredients'];

    for (const table of tables) {
        console.log(`\n--- Checking table: ${table} ---`);
        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.log(`Error or Table might not exist: ${error.message}`);
        } else {
            if (data.length > 0) {
                console.log('Columns:', Object.keys(data[0]));
            } else {
                // Determine columns by inserting dummy and failing? No, just say it exists but empty.
                console.log('Table exists but is empty. Cannot determine columns from SELECT *.');

                // Try to get structure via Rpc or just assuming standard from user hint?
                // Actually, let's try to query metadata via a special select if possible, or just proceed assuming we might need to create them.
            }
        }
    }
}

checkInventorySchema();
