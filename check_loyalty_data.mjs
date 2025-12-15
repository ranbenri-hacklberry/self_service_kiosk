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

async function checkLoyaltyData() {
    console.log('🔍 Checking loyalty_cards table structure...');

    // Get all loyalty cards
    const { data: cards, error: cardsError } = await supabase
        .from('loyalty_cards')
        .select('*')
        .limit(5);

    if (cardsError) {
        console.error('❌ Error fetching cards:', cardsError);
    } else {
        console.log('📊 Sample loyalty_cards:');
        console.log(JSON.stringify(cards, null, 2));

        if (cards && cards.length > 0) {
            console.log('\n📌 Column names in loyalty_cards:', Object.keys(cards[0]));
        }
    }

    // Test the RPC
    console.log('\n🔍 Testing get_loyalty_balance RPC with phone 0548888888...');
    const { data: balance, error: balanceError } = await supabase.rpc('get_loyalty_balance', {
        p_phone: '0548888888'
    });

    if (balanceError) {
        console.error('❌ RPC Error:', balanceError);
    } else {
        console.log('✅ RPC Result:', balance);
    }

    // Check recent transactions
    console.log('\n🔍 Recent loyalty_transactions...');
    const { data: txns, error: txnError } = await supabase
        .from('loyalty_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (txnError) {
        console.error('❌ Error fetching transactions:', txnError);
    } else {
        console.log('📊 Recent transactions:');
        console.log(JSON.stringify(txns, null, 2));
    }
}

checkLoyaltyData();
