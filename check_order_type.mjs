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

async function checkOrderSchema() {
    console.log('🔍 Checking orders table schema...');

    // We can't query information_schema directly easily with supabase-js without raw sql or rpc
    // So we'll fetch one order and check the type of order_number

    const { data, error } = await supabase
        .from('orders')
        .select('order_number')
        .limit(1);

    if (error) {
        console.error('❌ Error fetching order:', error);
    } else if (data && data.length > 0) {
        const orderNum = data[0].order_number;
        console.log('✅ Sample order_number:', orderNum);
        console.log('   Type:', typeof orderNum);
    } else {
        console.log('⚠️ No orders found to check.');
    }
}

checkOrderSchema();
