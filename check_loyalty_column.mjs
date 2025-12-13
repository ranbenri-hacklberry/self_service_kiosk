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

async function checkLoyaltyColumns() {
    console.log('🔍 Checking loyalty_cards table columns...');

    // Try to select the column from a row
    const { data, error } = await supabase
        .from('loyalty_cards')
        .select('total_coffees_purchased')
        .limit(1);

    if (error) {
        console.error('❌ Error fetching column:', error.message);
        console.error('   This confirms the column is missing!');
    } else {
        console.log('✅ Column exists! Data:', data);
    }
}

checkLoyaltyColumns();
