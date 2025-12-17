import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSuppliersSchema() {
    const { data, error } = await supabase.from('suppliers').select('*').limit(1);
    if (error) console.error('Error:', error);
    else if (data.length > 0) console.log('Columns:', Object.keys(data[0]));
    else console.log('Table empty, cannot infer columns. Assuming standard business_id, name.');
}

checkSuppliersSchema();
