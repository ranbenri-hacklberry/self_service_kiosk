
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function dumpAll() {
    const { data: items } = await supabase.from('menu_items').select('id, name').eq('business_id', '22222222-2222-2222-2222-222222222222');
    const { data: links } = await supabase.from('menuitemoptions').select('*');
    const { data: groups } = await supabase.from('optiongroups').select('*');

    console.log('Sample Links:', links?.slice(0, 5));
    console.log('Sample Items:', items?.slice(0, 5));
    console.log('Sample Groups:', groups?.slice(0, 5));
}

dumpAll();
