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
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTransactionsSchema() {
    console.log('🔍 Checking loyalty_transactions table schema...');

    const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error fetching transactions:', error.message);
    } else if (data && data.length > 0) {
        console.log('✅ Sample transaction keys:', Object.keys(data[0]));
    } else {
        console.log('⚠️ No transactions found, cannot check keys easily.');
        // Try to insert to fail and see error? No, let's just assume we need to fix it.
    }
}

checkTransactionsSchema();
