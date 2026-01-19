import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // If available, better for unrestricted updates. If not, anon might fail on RLS if not logged in.
// Actually, I don't have the service key in env usually. I rely on RLS policies allowing update or use the RPC I created if needed.
// But wait, RLS might block loose updates from Anon.
// The user has been running SQL via the dashboard mostly.
// However, the `analyze_inventory_weights.js` worked... wait, that was SELECT only.
// If I use the *anon* key, I am subject to RLS.
// I can try to use the `update_inventory_item_details` RPC which is `SECURITY DEFINER` and bypasses RLS!
// It takes `p_item_id` and `p_updates` (jsonb).

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const VEG_DATA = [
    { patterns: ['מלפפון'], weight: 100, yield: 95 },
    { patterns: ['עגבני', 'עגבנייה'], weight: 150, yield: 90 },
    { patterns: ['שרי'], weight: 15, yield: 95 },
    { patterns: ['בצל'], weight: 180, yield: 85 },
    { patterns: ['גזר'], weight: 100, yield: 85 },
    { patterns: ['גמבה', 'פלפל'], weight: 180, yield: 85 },
    { patterns: ['תפוח אדמה', 'תפו"א'], weight: 200, yield: 85 },
    { patterns: ['בטטה'], weight: 250, yield: 85 },
    { patterns: ['חציל'], weight: 350, yield: 90 },
    { patterns: ['קישוא'], weight: 150, yield: 95 },
    { patterns: ['לימון'], weight: 120, yield: 90 },
    { patterns: ['כרוב'], weight: 1500, yield: 85 },
    { patterns: ['חסה'], weight: 400, yield: 90 },
    { patterns: ['פטרוזיליה'], weight: 100, yield: 70 },
    { patterns: ['כוסברה'], weight: 100, yield: 70 },
    { patterns: ['נענע'], weight: 100, yield: 60 }
];

async function runUpdates() {
    console.log('Fetching inventory...');
    const { data: items, error } = await supabase.from('inventory_items').select('id, name, unit');

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    let updatedCount = 0;

    for (const item of items) {
        // Find matching veg rule
        const rule = VEG_DATA.find(r => r.patterns.some(p => item.name.includes(p)));

        if (rule) {
            console.log(`Updating ${item.name} -> Weight: ${rule.weight}g, Yield: ${rule.yield}%`);

            // Use RPC to bypass RLS
            const { error: updateError } = await supabase.rpc('update_inventory_item_details', {
                p_item_id: item.id,
                p_updates: {
                    weight_per_unit: rule.weight,
                    yield_percentage: rule.yield
                }
            });

            if (updateError) {
                console.error(`  Failed to update ${item.name}:`, updateError.message);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`\nDone! Updated ${updatedCount} items.`);
}

runUpdates();
