
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) env[key.trim()] = value.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function listCategories() {
    const businessId = '22222222-2222-2222-2222-222222222222';
    const { data: items } = await supabase.from('menu_items').select('category').eq('business_id', businessId);
    const categories = [...new Set(items.map(i => i.category))];
    console.log('Categories:', categories);
}

listCategories();
