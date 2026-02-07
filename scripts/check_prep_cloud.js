
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const CLOUD_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const CLOUD_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const cloud = createClient(CLOUD_URL, CLOUD_KEY);

const BUSINESS_ID = '11111111-1111-1111-1111-111111111111';

async function checkPrepInventory() {
    console.log(`Checking prepared_items_inventory in CLOUD...`);
    const { count, error } = await cloud
        .from('prepared_items_inventory')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', BUSINESS_ID);

    if (error) {
        console.error("Cloud Error:", error.message);
    } else {
        console.log(`Cloud Count for ${BUSINESS_ID}: ${count}`);
    }
}

checkPrepInventory();
