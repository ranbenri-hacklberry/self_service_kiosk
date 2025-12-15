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

async function checkMenuItemsSchema() {
    console.log('🔍 Checking menu_items table schema...');

    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error fetching menu_items:', error.message);
    } else {
        console.log('✅ Found menu_items keys:', Object.keys(data[0] || {}));
    }
}

checkMenuItemsSchema();
