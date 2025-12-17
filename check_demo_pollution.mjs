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

async function checkDemoItems() {
    console.log('🔍 Checking Items for Demo Business (222...)...');

    const demoBusinessId = '22222222-2222-2222-2222-222222222222';

    const { data: items, error } = await supabase
        .from('menu_items')
        .select('id, name, business_id')
        .eq('business_id', demoBusinessId);

    if (error) {
        console.error('❌ Error fetching demo items:', error.message);
        return;
    }

    if (!items || items.length === 0) {
        console.log('✅ Demo Business has 0 items (CLEAN).');
    } else {
        console.log(`⚠️ Demo Business has ${items.length} items!`);
        console.log('   These might be duplicates of the Pilot items.');
        items.forEach(item => {
            console.log(`   - [${item.id}] ${item.name}`);
        });
    }
}

checkDemoItems();
