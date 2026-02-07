
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envLocal = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Inspecting prepared_items_inventory ---');
    const { data, error } = await supabase.from('prepared_items_inventory').select('*').limit(1);
    if (error) {
        console.error('Error selecting prepared_items_inventory:', error);
    } else {
        console.log('Sample Row:', data[0]);
    }

    console.log('\n--- Inspecting menu_items with ID 248 ---');
    // Assuming 248 is the ID from the logs
    const { data: menuData, error: menuError } = await supabase.from('menu_items').select('id, name').eq('id', 248).limit(1);
    if (menuError) {
        console.error('Error selecting menu_items:', menuError);
    } else {
        console.log('Menu Item 248:', menuData);
    }
}

run();
