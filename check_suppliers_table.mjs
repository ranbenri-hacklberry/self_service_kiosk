import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSuppliers() {
    // Try to select from 'suppliers'
    const { data, error } = await supabase.from('suppliers').select('*').limit(1);
    const { data: data2, error: error2 } = await supabase.from('business_suppliers').select('*').limit(1);

    console.log('Suppliers Table:', error ? error.message : 'Exists');
    console.log('Business Suppliers Table:', error2 ? error2.message : 'Exists');
}

checkSuppliers();
