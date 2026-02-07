
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
    const bId = '11111111-1111-1111-1111-111111111111';
    const { data: items } = await supabase.from('menu_items').select('id, name, category').eq('business_id', bId);
    console.log(`--- ITEMS FOR ${bId} (עגלת קפה) ---`);
    console.log(`Count: ${items?.length || 0}`);
    console.log(JSON.stringify(items?.slice(0, 5), null, 2));

    const { data: groups } = await supabase.from('optiongroups').select('*').eq('business_id', bId);
    console.log(`--- GROUPS FOR ${bId} ---`);
    console.log(JSON.stringify(groups, null, 2));
}

check();
