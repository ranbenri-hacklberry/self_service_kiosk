import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using Anon key might not list buckets if RLS is strict, but let's try.
// If Anon fails, we might need Service Role key if available, but usually not in .env.local for frontend.
// Users usually put public buckets readable.

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
    console.log('🪣 Checking Storage Buckets...');

    const { data, error } = await supabase
        .storage
        .listBuckets();

    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Buckets:', data.map(b => b.name));
    }
}

checkBuckets();
