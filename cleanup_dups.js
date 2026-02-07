
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://gxzsxvbercpkgxraiaex.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g');

async function run() {
    const businessId = '8e4e05da-2d99-4bd9-aedf-8e54cbde930a';
    console.log('🧹 Starting cleanup for business:', businessId);

    // 1. Fetch all items for this business
    const { data: allItems } = await supabase.from('menu_items')
        .select('id, name, category, image_url')
        .eq('business_id', businessId)
        .eq('is_deleted', false);

    if (!allItems) {
        console.log('No items found.');
        return;
    }

    const itemsByName = new Map();

    allItems.forEach(item => {
        const key = `${item.name.trim()}:${item.category.trim()}`;
        if (!itemsByName.has(key)) itemsByName.set(key, []);
        itemsByName.get(key).push(item);
    });

    const idsToDelete = [];

    for (const [key, items] of itemsByName.entries()) {
        if (items.length > 1) {
            console.log(`🔍 Found duplicate for: ${key} (${items.length} versions)`);

            // Sort: prioritize ones WITH image_url (real ones)
            const withImage = items.filter(i => i.image_url && i.image_url.includes('supabase.co'));
            const withoutImage = items.filter(i => !i.image_url || !i.image_url.includes('supabase.co'));

            if (withImage.length > 0) {
                console.log(`✅ Keeping version with image. Marking ${withoutImage.length} cactus versions for deletion.`);
                withoutImage.forEach(i => idsToDelete.push(i.id));

                if (withImage.length > 1) {
                    console.log(`⚠️ Multiple versions with images found. Keeping only the latest one.`);
                    withImage.slice(0, -1).forEach(i => idsToDelete.push(i.id));
                }
            } else {
                console.log(`⚠️ None have images, keeping only one version.`);
                items.slice(0, -1).forEach(i => idsToDelete.push(i.id));
            }
        }
    }

    if (idsToDelete.length > 0) {
        console.log(`🗑️ Deleting ${idsToDelete.length} duplicate records...`);
        const { error } = await supabase.from('menu_items').delete().in('id', idsToDelete);
        if (error) console.error('Delete error:', error);
        else console.log('✨ Cleanup complete!');
    } else {
        console.log('✅ No duplicates found to clean.');
    }
}
run();
