
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkItemsToDelete() {
    const names = ['מאפה חמאה', 'פפיון ריקוטה תות'];

    // 1. Get IDs
    const { data: items, error } = await supabase
        .from('menu_items')
        .select('id, name')
        .in('name', names);

    if (error) {
        console.error("Error fetching items:", error);
        return;
    }

    console.log("Found items:", items);

    if (!items || items.length === 0) return;

    const ids = items.map(i => i.id);

    // 2. Check dependencies (Order Items)
    const { count, error: orderErr } = await supabase
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .in('menu_item_id', ids);

    if (orderErr) console.error("Error checking orders:", orderErr);
    else console.log(`Found ${count} related order_items (sales history).`);

    // 3. Check dependencies (Recipes)
    const { count: recipeCount, error: recipeErr } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .in('menu_item_id', ids);

    if (recipeErr) console.error("Error checking recipes:", recipeErr);
    else console.log(`Found ${recipeCount} related recipes.`);
}

checkItemsToDelete();
