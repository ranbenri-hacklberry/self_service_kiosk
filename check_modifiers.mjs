import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkModifiers() {
    console.log('🔍 Checking modifiers configuration...\n');

    // 1. Get all menu items (drinks)
    const { data: menuItems, error: menuError } = await supabase
        .from('menu_items')
        .select('id, name, category, is_hot_drink')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    if (menuError) {
        console.error('❌ Error fetching menu items:', menuError);
        return;
    }

    console.log(`📋 Found ${menuItems.length} menu items\n`);

    // 2. Get all option groups
    const { data: optionGroups, error: groupsError } = await supabase
        .from('option_groups')
        .select('*')
        .order('name', { ascending: true });

    if (groupsError) {
        console.error('❌ Error fetching option groups:', groupsError);
        return;
    }

    console.log(`📦 Found ${optionGroups.length} option groups:`);
    optionGroups.forEach(group => {
        console.log(`   - ${group.name} (ID: ${group.id})`);
    });
    console.log('');

    // 3. Get all option values
    const { data: optionValues, error: valuesError } = await supabase
        .from('option_values')
        .select('*')
        .order('group_id', { ascending: true })
        .order('name', { ascending: true });

    if (valuesError) {
        console.error('❌ Error fetching option values:', valuesError);
        return;
    }

    console.log(`🎯 Found ${optionValues.length} option values\n`);

    // Group values by group_id
    const valuesByGroup = {};
    optionValues.forEach(value => {
        if (!valuesByGroup[value.group_id]) {
            valuesByGroup[value.group_id] = [];
        }
        valuesByGroup[value.group_id].push(value);
    });

    // Display option groups with their values
    console.log('📊 Option Groups and Values:');
    console.log('═'.repeat(80));
    optionGroups.forEach(group => {
        console.log(`\n🏷️  ${group.name} (ID: ${group.id})`);
        const values = valuesByGroup[group.id] || [];
        values.forEach(value => {
            const defaultMark = value.is_default ? '⭐' : '  ';
            const price = value.price_adjustment ? `+${value.price_adjustment}₪` : '';
            console.log(`   ${defaultMark} ${value.name} ${price}`);
        });
    });
    console.log('\n' + '═'.repeat(80));

    // 4. Get item-option mappings
    const { data: itemOptions, error: mappingError } = await supabase
        .from('item_options')
        .select('*');

    if (mappingError) {
        console.error('❌ Error fetching item options:', mappingError);
        return;
    }

    console.log(`\n🔗 Found ${itemOptions.length} item-option mappings\n`);

    // 5. Analyze each menu item and its modifiers
    console.log('📝 Menu Items and Their Modifiers:');
    console.log('═'.repeat(80));

    for (const item of menuItems) {
        const itemMappings = itemOptions.filter(io => io.item_id === item.id);

        console.log(`\n☕ ${item.name} (${item.category})`);
        console.log(`   ID: ${item.id} | Hot Drink: ${item.is_hot_drink ? 'Yes' : 'No'}`);

        if (itemMappings.length === 0) {
            console.log(`   ⚠️  No modifiers configured`);
        } else {
            console.log(`   Modifiers (${itemMappings.length}):`);
            itemMappings.forEach(mapping => {
                const group = optionGroups.find(g => g.id === mapping.group_id);
                const values = valuesByGroup[mapping.group_id] || [];
                console.log(`      • ${group?.name || 'Unknown'} (${values.length} options)`);
            });
        }
    }

    console.log('\n' + '═'.repeat(80));

    // 6. Find items with potentially incorrect modifiers
    console.log('\n⚠️  Potential Issues:');
    console.log('═'.repeat(80));

    const milkGroup = optionGroups.find(g => g.name?.includes('חלב'));
    const milkGroupId = milkGroup?.id;

    menuItems.forEach(item => {
        const itemMappings = itemOptions.filter(io => io.item_id === item.id);
        const hasMilkModifier = itemMappings.some(io => io.group_id === milkGroupId);

        // Check if cold drink has milk modifier (might be wrong for some drinks)
        if (!item.is_hot_drink && hasMilkModifier && item.category === 'שתיה קרה') {
            const drinkName = item.name.toLowerCase();
            // Some cold drinks should have milk (iced latte, etc), others shouldn't (juice, water)
            if (drinkName.includes('מיץ') || drinkName.includes('מים') || drinkName.includes('לימונדה')) {
                console.log(`\n❌ ${item.name}`);
                console.log(`   Issue: Cold non-coffee drink has milk modifier`);
            }
        }

        // Check if hot drink is missing milk modifier
        if (item.is_hot_drink && !hasMilkModifier) {
            const drinkName = item.name.toLowerCase();
            // Some hot drinks don't need milk (tea, americano)
            if (!drinkName.includes('תה') && !drinkName.includes('אמריקנו')) {
                console.log(`\n⚠️  ${item.name}`);
                console.log(`   Issue: Hot coffee drink missing milk modifier`);
            }
        }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ Analysis complete!\n');
}

checkModifiers().catch(console.error);
