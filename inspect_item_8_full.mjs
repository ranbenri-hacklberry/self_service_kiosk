
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectItem8() {
    console.log('--- Inspecting Item 8 Columns ---');
    const { data, error } = await supabase.from('menu_items').select('*').eq('id', 8).single();
    if (error) console.error(error);
    console.log(JSON.stringify(data, null, 2));

    console.log('\n--- Inspecting Linked Groups for Item 8 ---');
    const { data: links } = await supabase.from('menuitemoptions').select('*').eq('item_id', 8);
    console.log(links);

    if (links && links.length > 0) {
        console.log('\n--- Inspecting Linked Groups Details ---');
        const ids = links.map(l => l.group_id);
        const { data: groups } = await supabase.from('optiongroups').select('*').in('id', ids);
        console.log(groups);
    }
}

inspectItem8();
