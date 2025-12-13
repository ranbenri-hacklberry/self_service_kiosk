// Script to add toppings (עגבניות, זיתים, בצל) to menu item 53
// Each topping costs 4 ILS
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

async function addToppingsToItem53() {
    console.log('🍅 Adding toppings to menu item 53...\n');
    console.log('═'.repeat(80));

    try {
        // Step 1: Check if item 53 exists
        console.log('📋 Step 1: Checking menu item 53...');
        const { data: menuItem, error: itemError } = await supabase
            .from('menu_items')
            .select('id, name, price, category')
            .eq('id', 53)
            .single();

        if (itemError || !menuItem) {
            throw new Error(`Menu item 53 not found: ${itemError?.message || 'Item does not exist'}`);
        }

        console.log(`   ✅ Found: ${menuItem.name} (${menuItem.category}) - ${menuItem.price} ש"ח\n`);

        // Step 2: Create option group "תוספות"
        console.log('📋 Step 2: Creating option group "תוספות"...');
        const { data: newGroup, error: groupError } = await supabase
            .from('optiongroups')
            .insert({
                name: 'תוספות',
                is_required: false,
                is_multiple_select: true,  // Allow multiple selections
                display_order: 10
            })
            .select()
            .single();

        if (groupError) {
            throw new Error(`Failed to create option group: ${groupError.message}`);
        }

        const groupId = newGroup.id;
        console.log(`   ✅ Created group with ID: ${groupId}\n`);

        // Step 3: Add 3 option values (עגבניות, זיתים, בצל) - each 4 ILS
        console.log('📋 Step 3: Adding 3 toppings (4 ILS each)...');
        const toppings = [
            { name: 'עגבניות', price: 4, order: 1 },
            { name: 'זיתים', price: 4, order: 2 },
            { name: 'בצל', price: 4, order: 3 }
        ];

        const { data: optionValues, error: valuesError } = await supabase
            .from('optionvalues')
            .insert(
                toppings.map(t => ({
                    group_id: groupId,
                    value_name: t.name,
                    price_adjustment: t.price,
                    display_order: t.order
                }))
            )
            .select();

        if (valuesError) {
            throw new Error(`Failed to create option values: ${valuesError.message}`);
        }

        console.log(`   ✅ Created ${optionValues.length} option values:`);
        optionValues.forEach(ov => {
            console.log(`      - ${ov.value_name}: +${ov.price_adjustment} ש"ח`);
        });
        console.log('');

        // Step 4: Link the group to menu item 53
        console.log('📋 Step 4: Linking group to menu item 53...');
        const { data: link, error: linkError } = await supabase
            .from('menuitemoptions')
            .insert({
                item_id: 53,
                group_id: groupId
            })
            .select()
            .single();

        if (linkError) {
            throw new Error(`Failed to link group to item: ${linkError.message}`);
        }

        console.log(`   ✅ Linked group to menu item 53\n`);

        // Step 5: Verify the result
        console.log('📋 Step 5: Verifying result...');
        const { data: verification, error: verifyError } = await supabase
            .from('menu_items')
            .select(`
                id,
                name,
                price,
                menuitemoptions (
                    optiongroups (
                        id,
                        name,
                        is_multiple_select,
                        optionvalues (
                            id,
                            value_name,
                            price_adjustment,
                            display_order
                        )
                    )
                )
            `)
            .eq('id', 53)
            .single();

        if (verifyError) {
            console.warn(`   ⚠️  Verification query failed: ${verifyError.message}`);
        } else {
            console.log(`   ✅ Verification successful!\n`);
            console.log('📊 Final result:');
            console.log('═'.repeat(80));
            console.log(`   Item: ${verification.name} (ID: ${verification.id})`);
            console.log(`   Base Price: ${verification.price} ש"ח\n`);

            if (verification.menuitemoptions && verification.menuitemoptions.length > 0) {
                verification.menuitemoptions.forEach(mio => {
                    const group = mio.optiongroups;
                    console.log(`   Group: ${group.name} (Multiple: ${group.is_multiple_select ? 'Yes' : 'No'})`);
                    if (group.optionvalues && group.optionvalues.length > 0) {
                        group.optionvalues
                            .sort((a, b) => a.display_order - b.display_order)
                            .forEach(ov => {
                                console.log(`      - ${ov.value_name}: +${ov.price_adjustment} ש"ח`);
                            });
                    }
                });
            }
        }

        console.log('\n' + '═'.repeat(80));
        console.log('\n✨ Successfully added toppings to menu item 53!\n');
        console.log('   ✅ Created group: "תוספות"');
        console.log('   ✅ Added 3 options: עגבניות, זיתים, בצל (4 ש"ח each)');
        console.log('   ✅ Linked to menu item 53\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run the script
addToppingsToItem53();

