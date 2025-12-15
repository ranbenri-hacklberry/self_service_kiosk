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

async function checkLoyaltyRpc() {
    console.log('🔍 Testing handle_loyalty_purchase RPC...');

    // Use a dummy phone number
    const phone = '0500000000'; // Demo phone

    const { data, error } = await supabase.rpc('handle_loyalty_purchase', {
        p_phone: phone,
        p_order_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        p_items_count: 1,
        p_redeemed_count: 0
    });

    if (error) {
        console.error('❌ RPC Failed:', error.message);
        console.error('   Details:', error);
    } else {
        console.log('✅ RPC Success!', data);
    }
}

checkLoyaltyRpc();
