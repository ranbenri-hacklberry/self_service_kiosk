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
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKdsRpc() {
    console.log('🔍 Testing get_kds_orders RPC...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = Date.now();
    const { data, error } = await supabase.rpc('get_kds_orders', {
        p_date: today.toISOString()
    });
    const duration = Date.now() - start;

    if (error) {
        console.error('❌ RPC Failed:', error.message);
        console.error('   Hint: You probably need to run the SQL script in Supabase SQL Editor.');
        console.error('   Details:', error);
    } else {
        console.log(`✅ RPC Success! Took ${duration}ms`);
        console.log(`   Returned ${data?.length || 0} orders.`);
        if (data && data.length > 0) {
            console.log('   First order sample:', JSON.stringify(data[0], null, 2));
        }
    }
}

checkKdsRpc();
