const { createClient } = require('@supabase/supabase-js');

/**
 * STANDARD SUPABASE CLIENT INITIALIZATION
 * Hybrid logic: Tries Local Supabase first, then falls back to Cloud.
 */
async function initSupabase() {
    const localUrl = process.env.LOCAL_SUPABASE_URL;
    const localKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;
    const cloudUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const cloudKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    let supabase = null;
    let isLocal = false;

    // 1. Try Local Supabase if configured
    if (localUrl && localKey) {
        try {
            console.log(`🔍 Checking Local Supabase at ${localUrl}...`);

            // Active check: Try to fetch the rest endpoint
            // Using a short timeout to prevent hanging the boot process
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${localUrl}/rest/v1/`, {
                method: 'GET',
                headers: { 'apikey': localKey },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                supabase = createClient(localUrl, localKey);
                isLocal = true;
                console.log('✅ Local Supabase Detected - Running in LOCAL mode.');
                return { supabase, isLocal, url: localUrl };
            }
        } catch (err) {
            console.log('ℹ️ Local Supabase check failed or timed out:', err.message);
        }
    }

    // 2. Fallback to Cloud Supabase
    if (cloudUrl && cloudKey) {
        try {
            supabase = createClient(cloudUrl, cloudKey);
            isLocal = false;
            console.log('ℹ️ Using Remote Supabase Fallback.');
            return { supabase, isLocal, url: cloudUrl };
        } catch (err) {
            console.error('❌ Failed to create cloud Supabase client:', err.message);
        }
    }

    console.error('❌ No Supabase configuration available!');
    return { supabase: null, isLocal: false, url: null };
}

// For CommonJS compatibility (api/*.js)
module.exports = { initSupabase };
