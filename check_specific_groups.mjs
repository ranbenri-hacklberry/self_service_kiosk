
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSpecificGroups() {
    const ids = [
        'e2b43360-5831-4402-b96d-c08d5d0cbd59', // The one I see as direct
        '6fb8763d-8f80-4f22-b01e-48999968891d'  // The clone I thought existed
    ];
    console.log('--- Checking Specific IDs ---');
    const { data: groups } = await supabase.from('optiongroups').select('*').in('id', ids);
    console.log(groups);
}

checkSpecificGroups();
