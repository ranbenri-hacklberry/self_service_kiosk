import { createClient } from '@supabase/supabase-js';

// Credentials from check_business_id.mjs which we know are valid for Anon
const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugRPC() {
    console.log('🔍 Testing get_all_business_stats RPC...');

    const start = Date.now();
    const { data, error } = await supabase.rpc('get_all_business_stats');
    const duration = Date.now() - start;

    if (error) {
        console.error('❌ RPC Failed:', error);
        console.error('Details:', error.message, error.details, error.hint);
    } else {
        console.log(`✅ RPC Success (${duration}ms)`);
        console.log(`📊 Valid Data Received: ${Array.isArray(data)}`);
        console.log(`🔢 Count: ${data?.length}`);
        if (data && data.length > 0) {
            console.log('📝 Sample Row:', data[0]);
        } else {
            console.log('⚠️ Data is empty array!');
        }
    }
}

debugRPC().catch(console.error);
