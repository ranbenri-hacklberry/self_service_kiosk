import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using Anon for read
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Fallback

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing ENV vars");
    process.exit(1);
}

// Use service key if available to bypass RLS for debugging
const supabase = createClient(supabaseUrl, serviceKey || supabaseKey);

async function inspect() {
    console.log("--- DEBUGGING LEAK ---");

    // 1. Check Demo User
    const { data: user } = await supabase
        .from('employees')
        .select('*')
        .eq('whatsapp_phone', '0500000000')
        .single();

    console.log("DEMO USER:", user ? { id: user.id, name: user.name, business_id: user.business_id } : "NOT FOUND");

    // 2. Check Last Order
    const { data: order } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    console.log("LAST ORDER:", order ? { id: order.id, business_id: order.business_id, total: order.total_amount, created: order.created_at } : "NONE");

    // 3. Check Businesses
    const { data: businesses } = await supabase.from('businesses').select('id, name');
    console.log("BUSINESSES:", businesses);
}

inspect();
