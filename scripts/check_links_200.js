
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkLinks() {
    const { data } = await supabase.from('menuitemoptions').select('*').gte('item_id', 200);
    console.log('Links for items >= 200:', data?.length || 0);
    if (data && data.length > 0) {
        console.log('Sample link:', data[0]);
    }

    const { data: allGroups } = await supabase.from('optiongroups').select('id, name, business_id');
    console.log('All groups:', allGroups?.length || 0);
}

checkLinks();
