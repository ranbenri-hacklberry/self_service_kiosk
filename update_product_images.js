
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 🛠️ PRODUCT IMAGE UPDATER
 * Use this to link images to items in the database.
 */
async function updateProduct(itemId, aiImageUrl, seedImageUrl = null) {
    console.log(`Updating Item ID: ${itemId}...`);

    const updates = {};
    if (aiImageUrl) updates.image_url = aiImageUrl;

    // If a seed (original) image is provided, add it to the array
    if (seedImageUrl) {
        const { data: item } = await supabase.from('menu_items').select('original_image_urls').eq('id', itemId).single();
        const currentSeeds = item?.original_image_urls || [];
        if (!currentSeeds.includes(seedImageUrl)) {
            updates.original_image_urls = [...currentSeeds, seedImageUrl];
        }
    }

    const { error } = await supabase.from('menu_items').update(updates).eq('id', itemId);

    if (error) {
        console.error(`❌ Error updating item ${itemId}:`, error.message);
    } else {
        console.log(`✅ Item ${itemId} updated successfully.`);
    }
}

// --- EXAMPLE USAGE ---
// updateProduct(12, 'https://.../ai_image.jpg', 'https://.../original_seed.jpg');

// To run this script for multiple items, uncomment and edit below:
/*
const myUpdates = [
    { id: 12, ai: 'URL_FOR_AI', seed: 'URL_FOR_SEED' },
];
for(const entry of myUpdates) {
    await updateProduct(entry.id, entry.ai, entry.seed);
}
*/

console.log("Edit this script to include your specific IDs and URLs and run with 'node update_product_images.js'");
