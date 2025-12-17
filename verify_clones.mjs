
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
// Fix: Handle cases where only one exists or neither
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('--- Verifying Options for Items 8 & 9 ---');

    for (const itemId of [8, 9]) {
        console.log(`\nItem ${itemId}:`);
        // Get links
        const { data: links } = await supabase.from('menuitemoptions').select('group_id').eq('item_id', itemId);

        if (links && links.length > 0) {
            const groupIds = links.map(l => l.group_id);
            // Get Groups
            const { data: groups } = await supabase.from('optiongroups').select('*').in('id', groupIds);

            groups.forEach(g => {
                console.log(`- Group: "${g.name}" (ID: ${g.id})`);
                console.log(`  Required: ${g.is_required}, Multi: ${g.is_multiple_select}`);
            });
        } else {
            console.log('- No linked groups found.');
        }
    }
}

verify();
