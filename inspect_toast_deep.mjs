
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectItem7Deep() {
    console.log('--- Inspecting Item 7 Links ---');
    const { data: links, error: linkError } = await supabase.from('menuitemoptions').select('*').eq('item_id', 7);
    if (linkError) console.error('Link Error:', linkError);
    console.log('Links:', links);

    if (links && links.length > 0) {
        const groupId = links[0].group_id;
        console.log(`\n--- Inspecting Group: ${groupId} ---`);

        // 1. Try normal fetch
        const { data: group, error: groupError } = await supabase.from('optiongroups').select('*').eq('id', groupId).maybeSingle();
        console.log('Group Fetch Result:', group);
        if (groupError) console.error('Group Fetch Error:', groupError);

        // 2. Try fetching ALL groups to see if RLS is blocking specific ID? (unlikely but possible)
        // actually if maybeSingle returns null and no error, it means RLS hid it or it doesn't exist.

        if (!group && !groupError) {
            console.warn("!!! Group ID exists in Link table but returned NULL from optiongroups table.");
            console.warn("!!! This likely means RLS is hiding it OR it was deleted.");
        }
    }
}

inspectItem7Deep();
