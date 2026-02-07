
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const CLOUD_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const CLOUD_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
// Using Service Role for Cloud if available to bypass RLS and see REAL count
const CLOUD_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const targetKey = CLOUD_SERVICE_KEY || CLOUD_KEY;

if (!targetKey) {
    console.error("❌ Missing CLOUD keys in env.");
    process.exit(1);
}

const cloud = createClient(CLOUD_URL, targetKey);
const BUSINESS_ID = '11111111-1111-1111-1111-111111111111';

async function diagnoseCloud() {
    console.log(`☁️ Diagnosing CLOUD Table: menuitemoptions`);
    console.log(`🔑 Using Key Type: ${CLOUD_SERVICE_KEY ? 'SERVICE_ROLE (Admin)' : 'ANON (Public)'}`);

    // If using ANON, RLS might hide data unless we fake a login, but let's try raw first

    // 1. Total Raw Count
    const { count: total, error } = await cloud
        .from('menuitemoptions')
        .select('*', { count: 'exact', head: true });

    if (error) console.error("Cloud Error:", error.message);
    console.log(`☁️ Total Cloud Rows: ${total}`);

    // 2. Count for OUR Business
    const { count: bizCount, error: bizError } = await cloud
        .from('menuitemoptions')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', BUSINESS_ID);

    console.log(`🏢 Rows for Business ${BUSINESS_ID}: ${bizCount}`);

    // 3. Count for OTHER Businesses (The Leak Source)
    const { count: otherCount } = await cloud
        .from('menuitemoptions')
        .select('*', { count: 'exact', head: true })
        .neq('business_id', BUSINESS_ID);

    console.log(`⚠️ Rows for OTHER businesses (Potential Leak): ${otherCount}`);
}

diagnoseCloud();
