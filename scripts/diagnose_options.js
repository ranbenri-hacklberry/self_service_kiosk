
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.VITE_LOCAL_SERVICE_ROLE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY;

if (!LOCAL_KEY) {
    console.error("❌ Missing LOCAL_KEY env.");
    process.exit(1);
}

const local = createClient(LOCAL_URL, LOCAL_KEY);

const BUSINESS_ID = '11111111-1111-1111-1111-111111111111';

async function diagnose() {
    console.log(`🔍 Diagnosing Docker Table: menuitemoptions`);

    // 1. Exact Count via Service Role (Bypass RLS)
    const { count: totalCount, error: countError } = await local
        .from('menuitemoptions')
        .select('*', { count: 'exact', head: true });
    //.eq('business_id', BUSINESS_ID); // menuitemoptions might not have business_id directly? Let's check.

    console.log(`🐳 Total Docker Count (No Filters): ${totalCount}`);

    // 2. Count via Join (if business_id is missing) or standard filter
    // Let's try to filter by ID logic if possible, or just dump first 100
    const { data, error } = await local
        .from('menuitemoptions')
        .select('*')
        .limit(100);

    if (data) {
        // Check if they have business_id
        const hasBusinessId = data.length > 0 && 'business_id' in data[0];
        console.log(`📋 Rows have business_id? ${hasBusinessId}`);

        if (hasBusinessId) {
            const bizCount = data.filter(r => r.business_id === BUSINESS_ID).length;
            console.log(`📊 Rows matching Business ID in sample: ${bizCount} / ${data.length}`);

            // Real query with filter
            const { count: filteredCount } = await local
                .from('menuitemoptions')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID);
            console.log(`🎯 Exact Count for Business: ${filteredCount}`);
        }
    }
}

diagnose();
