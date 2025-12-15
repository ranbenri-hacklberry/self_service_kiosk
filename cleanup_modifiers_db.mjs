// Script to clean up incorrect modifier assignments using Supabase directly
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually
const envPath = path.join(__dirname, '.env');
let supabaseUrl, supabaseKey;

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
            supabaseUrl = trimmed.split('=')[1].trim();
        } else if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
            supabaseKey = trimmed.split('=')[1].trim();
        }
    }
} catch (error) {
    console.error('❌ Could not read .env file:', error.message);
    process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error('   VITE_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   VITE_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupModifiers(dryRun = true) {
    console.log('🧹 Starting modifier cleanup...\n');
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚠️  LIVE MODE (changes will be applied)'}\n`);
    console.log('═'.repeat(80));

    try {
        // Categories that should NOT have coffee modifiers
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

        // Get all items in non-drink categories that have modifiers
        const { data: itemsWithModifiers, error: queryError } = await supabase
            .from('menu_items')
            .select(`
        id,
        name,
        category,
        item_options (
          group_id,
          option_groups (
            id,
            name
          )
        )
      `)
            .in('category', nonDrinkCategories);

        if (queryError) {
            throw new Error(`Failed to query items: ${queryError.message}`);
        }

        console.log(`\n📋 Found ${itemsWithModifiers.length} items in non-drink categories\n`);

        // Filter items that actually have modifiers
        const itemsToClean = itemsWithModifiers.filter(item =>
            item.item_options && item.item_options.length > 0
        );

        console.log('\n📊 Items that need cleaning:');
        console.log('═'.repeat(80));

        if (itemsToClean.length === 0) {
            console.log('\n✅ No items need cleaning! Everything looks good.\n');
            return;
        }

        console.log(`\nFound ${itemsToClean.length} items with incorrect modifiers:\n`);

        itemsToClean.forEach((item, index) => {
            const modifierGroups = [...new Set(
                item.item_options.map(io => io.option_groups?.name).filter(Boolean)
            )];

            console.log(`${index + 1}. ${item.name} (${item.category})`);
            console.log(`   ID: ${item.id}`);
            console.log(`   Modifiers to remove (${modifierGroups.length}): ${modifierGroups.join(', ')}`);
            console.log('');
        });

        if (dryRun) {
            console.log('═'.repeat(80));
            console.log('\n🔍 DRY RUN MODE - No changes were made');
            console.log('\nTo apply these changes, run:');
            console.log('   node cleanup_modifiers_db.mjs --apply\n');
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

                // Delete all item_options entries for this item
                const { error: deleteError } = await supabase
                    .from('item_options')
                    .delete()
                    .eq('item_id', item.id);

                if (deleteError) {
                    throw new Error(deleteError.message);
                }

                console.log(`   ✅ Success - removed ${item.item_options.length} modifier assignments`);
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
        process.exit(1);
    }
}

// Check if --apply flag is present
const applyChanges = process.argv.includes('--apply');
cleanupModifiers(!applyChanges);
