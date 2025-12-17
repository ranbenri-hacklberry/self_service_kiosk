
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRedundantLink() {
    console.log('--- Checking for Redundant Link ---');
    const { data: links } = await supabase.from('menuitemoptions')
        .select('*')
        .eq('item_id', 8)
        .eq('group_id', 'e2b43360-5831-4402-b96d-c08d5d0cbd59');
    console.log(links);
}

checkRedundantLink();
