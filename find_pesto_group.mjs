
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findPestoGroup() {
    console.log('--- Finding "Pesto" Groups ---');
    const { data: groups } = await supabase.from('optiongroups')
        .select('*')
        .ilike('name', '%פסטו%');
    console.log(groups);
}

findPestoGroup();
