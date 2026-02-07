
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkModifiers() {
    const bizId = '11111111-1111-1111-1111-111111111111';
    console.log(`Checking modifiers for business ${bizId}...`);

    const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, modifiers')
        .eq('business_id', bizId);

    if (error) {
        console.error(error);
        return;
    }

    data.forEach(item => {
        console.log(`Item: ${item.name} (${item.id})`);
        console.log(`Modifiers:`, JSON.stringify(item.modifiers, null, 2));
        console.log('---');
    });
}

checkModifiers();
