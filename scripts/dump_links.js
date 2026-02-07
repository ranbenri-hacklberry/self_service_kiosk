
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function dumpLinks() {
    const businessId = '22222222-2222-2222-2222-222222222222';

    console.log('---ITEM LINKS---');
    const { data: items } = await supabase.from('menu_items').select('id, name').eq('business_id', businessId);
    const itemIds = items.map(i => i.id);

    const { data: links } = await supabase.from('menuitemoptions').select('*').in('item_id', itemIds);
    console.log('Links count:', links?.length || 0);

    const { data: groups } = await supabase.from('optiongroups').select('*').eq('business_id', businessId);
    console.log('Groups count:', groups?.length || 0);

    const { data: privateGroups } = await supabase.from('optiongroups').select('*').in('menu_item_id', itemIds);
    console.log('Private Groups count:', privateGroups?.length || 0);

    // Final check for a sample item like "קפוצ׳ינו"
    const capp = items.find(i => i.name === 'קפוצ׳ינו');
    if (capp) {
        console.log('Cappuccino ID:', capp.id);
        const { data: cappLinks } = await supabase.from('menuitemoptions').select('group_id').eq('item_id', capp.id);
        console.log('Cappuccino Links:', cappLinks);
    }
}

dumpLinks();
