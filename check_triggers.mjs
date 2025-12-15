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

async function checkTriggers() {
    console.log('🔍 Checking triggers on orders table...');

    // We can't query information_schema directly easily via JS client without RPC
    // But we can try to insert a dummy order and see if it fails fast

    const dummyOrder = {
        customer_name: 'Test Trigger',
        order_status: 'pending',
        total_amount: 0
    };

    const { data, error } = await supabase
        .from('orders')
        .insert(dummyOrder)
        .select()
        .single();

    if (error) {
        console.error('❌ Insert failed:', error.message);
    } else {
        console.log('✅ Insert success! Order ID:', data.id);
        // Cleanup
        await supabase.from('orders').delete().eq('id', data.id);
        console.log('🧹 Cleanup done.');
    }
}

checkTriggers();
