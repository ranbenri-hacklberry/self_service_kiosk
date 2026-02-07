
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const REMOTE_URL = process.env.VITE_SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.VITE_LOCAL_SERVICE_ROLE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY;

if (!REMOTE_URL || !REMOTE_KEY || !LOCAL_KEY) {
    console.error("❌ Missing Missing ENVs. Check .env file.");
    process.exit(1);
}

const remote = createClient(REMOTE_URL, REMOTE_KEY);
const local = createClient(LOCAL_URL, LOCAL_KEY);

const BUSINESS_ID = '11111111-1111-1111-1111-111111111111'; // Assuming this is the test business ID based on previous context, or I'll query one.
const TABLE = 'prepared_items_inventory';

async function diagnose() {
    console.log(`🔍 Diagnosing table: ${TABLE}`);

    // 1. Check Cloud Content (Raw)
    const { data: cloudSample, error: cloudError } = await remote
        .from(TABLE)
        .select('*')
        .limit(5);

    if (cloudError) {
        console.error('❌ Cloud Fetch Error:', cloudError.message);
    } else {
        console.log('☁️ Cloud Records (First 5):', JSON.stringify(cloudSample, null, 2));
    }

    // 2. Check Local Content (Raw)
    const { data: localSample, error: localError } = await local
        .from(TABLE)
        .select('*')
        .limit(5);

    if (localError) {
        console.error('❌ Local Fetch Error:', localError.message);
    } else {
        console.log('🐳 Local Records (First 5):', JSON.stringify(localSample, null, 2));
    }
}

diagnose();
