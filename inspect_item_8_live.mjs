
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectItem8PricesAndSettings() {
    console.log('--- Inspecting Item 8 Group Settings & Prices ---');
    const { data: links } = await supabase.from('menuitemoptions').select('group_id').eq('item_id', 8);
    const gIds = links?.map(l => l.group_id) || [];
    console.log('Group IDs:', gIds);

    if (gIds.length > 0) {
        const { data: groups } = await supabase.from('optiongroups').select('*').in('id', gIds);
        console.log('Groups:', JSON.stringify(groups, null, 2));

        const { data: vals } = await supabase.from('optionvalues').select('*').in('group_id', gIds);
        console.log('Values:', JSON.stringify(vals, null, 2));
    }
}

inspectItem8PricesAndSettings();
