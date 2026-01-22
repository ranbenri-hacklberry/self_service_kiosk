const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- Businesses Check ---');
    const { data: businesses, error } = await supabase
        .from('businesses')
        .select('*');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${businesses.length} businesses:`);
        businesses.forEach(b => {
            console.log(`ID: ${b.id}, Name: ${b.name}`);
        });
    }

    console.log('\n--- Menu Items Check ---');
    const { data: items, error: itemErr } = await supabase
        .from('menu_items')
        .select('name, business_id')
        .limit(10);

    if (itemErr) {
        console.error('Item error:', itemErr.message);
    } else {
        items.forEach(i => {
            console.log(`Item: ${i.name}, Business: ${i.business_id}`);
        });
    }
}

check();
