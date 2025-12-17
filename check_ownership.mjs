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

async function checkMenuItemsOwnership() {
    console.log('🔍 Checking Menu Items Ownership...');

    const { data: items, error } = await supabase
        .from('menu_items')
        .select('id, name, business_id')
        .limit(20);

    if (error) {
        console.error('❌ Error fetching menu items:', error.message);
        return;
    }

    console.log(`✅ Found ${items.length} items.`);
    items.forEach(item => {
        console.log(`   - [${item.id}] ${item.name} | Business ID: ${item.business_id}`);
    });
}

checkMenuItemsOwnership();
