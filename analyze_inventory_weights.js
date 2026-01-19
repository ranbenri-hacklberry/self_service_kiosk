import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function analyzeInventory() {
    try {
        const { data: items, error } = await supabase
            .from('inventory_items')
            .select('*')
            .order('name');

        if (error) throw error;

        console.log('--- Inventory Weight Analysis ---');
        console.log(`Total items: ${items.length}`);

        const missingWeight = items.filter(i => (i.unit === 'יח׳' || i.unit === 'unit') && (!i.weight_per_unit || i.weight_per_unit === 0));

        console.log(`\nItems with Unit='יח׳' but NO Weight defined (${missingWeight.length}):`);
        missingWeight.forEach(i => {
            console.log(`- [ID: ${i.id}] ${i.name} (Category: ${i.category_id || 'N/A'})`);
        });

        // Try to identify vegetables based on common names
        const vegKeywords = ['עגבני', 'מלפפון', 'חסה', 'בצל', 'גזר', 'פלפל', 'קישוא', 'חציל', 'תפוח', 'אגס', 'לימון', 'תפוז', 'בטטה', 'כרוב', 'כרובית', 'פטרוזיליה', 'כוסברה', 'נענע', 'שמיר', 'בזיליקום'];

        const potentialVegs = items.filter(i => vegKeywords.some(kw => i.name.includes(kw)));

        console.log(`\nPotential Vegetables/Produce found (${potentialVegs.length}):`);
        potentialVegs.forEach(i => {
            console.log(`- ${i.name}: Current Weight: ${i.weight_per_unit || 0}, Unit: ${i.unit}`);
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

analyzeInventory();
