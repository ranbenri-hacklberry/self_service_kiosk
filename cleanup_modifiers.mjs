// Script to clean up incorrect modifier assignments
// This will remove coffee modifiers from non-drink items

const API_BASE_URL = 'https://aimanageragentrani-625352399481.europe-west1.run.app';

async function fetchMenuItems() {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'תפריט' })
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch menu: ${response.statusText}`);
    }

    const result = await response.json();
    return result?.data || result?.menuItems || result || [];
}

async function fetchItemOptions(itemId) {
    const response = await fetch(`${API_BASE_URL}/item/${itemId}/options`);

    if (!response.ok) {
        if (response.status === 404) {
            return [];
        }
        throw new Error(`Failed to fetch options for item ${itemId}: ${response.statusText}`);
    }

    return await response.json();
}

async function removeModifiersFromItem(itemId) {
    // This will send a command to remove all modifiers from an item
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            command: `הסר את כל המודיפיירים מפריט ${itemId}`
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to remove modifiers from item ${itemId}: ${response.statusText}`);
    }

    return await response.json();
}

async function cleanupModifiers(dryRun = true) {
    console.log('🧹 Starting modifier cleanup...\n');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE MODE (changes will be applied)'}\n`);
    console.log('═'.repeat(80));

    try {
        const menuItems = await fetchMenuItems();
        console.log(`\n📋 Found ${menuItems.length} menu items\n`);

        // Define categories that should NOT have coffee modifiers
        const nonDrinkCategories = [
            'מאפים',
            'סלטים',
            'סלט',
            'כריכים וטוסטים',
            'כריכים וטוסט',
            'כריכים',
            'טוסטים',
            'קינוחים',
            'תוספות'
        ];

        const itemsToClean = [];

        // Find items that need cleaning
        for (const item of menuItems) {
            const shouldNotHaveModifiers = nonDrinkCategories.includes(item.category);

            if (shouldNotHaveModifiers) {
                const options = await fetchItemOptions(item.id);

                if (options.length > 0) {
                    itemsToClean.push({
                        id: item.id,
                        name: item.name,
                        category: item.category,
                        modifierCount: options.length,
                        modifiers: options.map(g => g.name || g.title)
                    });
                }
            }
        }

        console.log('\n📊 Items that need cleaning:');
        console.log('═'.repeat(80));

        if (itemsToClean.length === 0) {
            console.log('\n✅ No items need cleaning! Everything looks good.\n');
            return;
        }

        console.log(`\nFound ${itemsToClean.length} items with incorrect modifiers:\n`);

        itemsToClean.forEach((item, index) => {
            console.log(`${index + 1}. ${item.name} (${item.category})`);
            console.log(`   ID: ${item.id}`);
            console.log(`   Modifiers to remove (${item.modifierCount}): ${item.modifiers.join(', ')}`);
            console.log('');
        });

        if (dryRun) {
            console.log('═'.repeat(80));
            console.log('\n🔍 DRY RUN MODE - No changes were made');
            console.log('\nTo apply these changes, run:');
            console.log('   node cleanup_modifiers.mjs --apply\n');
            return;
        }

        // Apply changes
        console.log('═'.repeat(80));
        console.log('\n⚠️  Applying changes...\n');

        let successCount = 0;
        let errorCount = 0;

        for (const item of itemsToClean) {
            try {
                console.log(`🔧 Removing modifiers from: ${item.name}...`);
                await removeModifiersFromItem(item.id);
                console.log(`   ✅ Success`);
                successCount++;
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                errorCount++;
            }
        }

        console.log('\n' + '═'.repeat(80));
        console.log('\n📊 Summary:');
        console.log(`   ✅ Successfully cleaned: ${successCount} items`);
        console.log(`   ❌ Errors: ${errorCount} items`);
        console.log('\n✨ Cleanup complete!\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
    }
}

// Check if --apply flag is present
const applyChanges = process.argv.includes('--apply');
cleanupModifiers(!applyChanges);
