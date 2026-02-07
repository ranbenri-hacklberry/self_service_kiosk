
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: businesses } = await supabase.from('businesses').select('id, name');
    console.log('--- ALL BUSINESSES ---');
    console.log(JSON.stringify(businesses, null, 2));

    const businessId = '22222222-2222-2222-2222-222222222222';
    const { data: items } = await supabase.from('menu_items').select('id, name').eq('business_id', businessId).limit(5);
    console.log(`--- SAMPLE ITEMS FOR ${businessId} ---`);
    console.log(JSON.stringify(items, null, 2));
}

check();
