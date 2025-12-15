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

async function checkRecentTx() {
    console.log('🔍 Recent loyalty_transactions (last 10)...');

    const { data: txns, error } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('❌ Error:', error);
    } else {
        txns.forEach(tx => {
            console.log(`[${tx.created_at}] Type: ${tx.transaction_type}, Change: ${tx.change_amount}, Points Earned: ${tx.points_earned}`);
        });
    }

    // Also check current loyalty card state
    console.log('\n🔍 Current loyalty card for 0548888888...');
    const { data: card } = await supabase
        .from('loyalty_cards')
        .select('*')
        .eq('customer_phone', '0548888888')
        .single();

    console.log('Card:', card);
}

checkRecentTx();
