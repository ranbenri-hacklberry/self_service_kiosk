
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspectValues() {
    const groupId = 'a7c44cf5-dc60-4944-abfa-d3d3f307e146';
    console.log(`--- Inspecting Values for Group ${groupId} ---`);
    const { data: values, error } = await supabase.from('optionvalues').select('*').eq('group_id', groupId);
    if (error) console.error(error);
    console.log(values);
}

inspectValues();
