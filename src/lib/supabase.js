import { createClient } from '@supabase/supabase-js';

const cloudUrl = import.meta.env?.VITE_SUPABASE_URL;
const cloudKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
// FORCE 127.0.0.1 to avoid 503 errors on LAN IP
const localUrl = 'http://127.0.0.1:54321';
const localKey = import.meta.env?.VITE_LOCAL_SUPABASE_ANON_KEY || cloudKey;

if (!cloudUrl || !cloudKey) {
    console.error('🚨 Supabase environment variables missing!');
}

let activeClient = null;
let isLocal = false;

/**
 * Update the active client instance
 */
const getClient = (url, key) => {
    if (activeClient && activeClient.supabaseUrl === url) return activeClient;
    return createClient(url, key, {
        auth: {
            persistSession: true,
            storageKey: 'supabase.auth.token',
            storage: window.localStorage,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
};

// Initial default - Start with local if we're on a known local network or have a local URL
const isLikelyLocal = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.search.includes('local=true');

// FORCE LOCAL MODE Strategy
activeClient = createClient(isLikelyLocal ? localUrl : cloudUrl, isLikelyLocal ? localKey : cloudKey, {
    auth: { storage: window.localStorage }
});
isLocal = isLikelyLocal;

export const supabase = new Proxy({}, {
    get: (target, prop) => activeClient[prop]
});

export const initSupabase = async () => {
    console.log(`🔌 Initializing Supabase Connection (Target: ${isLikelyLocal ? 'LOCAL ONLY' : 'CLOUD'})`);

    if (isLikelyLocal) {
        try {
            // Validate Local Connection
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${localUrl}/rest/v1/`, {
                method: 'GET',
                headers: { 'apikey': localKey },
                signal: controller.signal
            }).catch(err => {
                throw new Error(`Local connection refused: ${err.message}`);
            });
            clearTimeout(timeoutId);

            if (response && response.ok) {
                isLocal = true;
                activeClient = getClient(localUrl, localKey);
                console.log('🏘️ CONNECTED: Using Local Supabase (127.0.0.1:54321)');
                localStorage.setItem('is_local_instance', 'true');
            } else {
                console.error(`❌ Local Supabase unreachable (Status: ${response?.status}). Please ensure Docker is running.`);
                // CRITICAL: Even if check fails, we STAY on local config so user sees the error instead of silently switching to cloud
                // This prevents the "split brain" data issue.
                isLocal = true;
                activeClient = getClient(localUrl, localKey);
            }
        } catch (e) {
            console.error('❌ Local connection failed entirely:', e);
            // We still enforce local client to avoid confusion
            isLocal = true;
            activeClient = getClient(localUrl, localKey);
        }
    } else {
        // Production / Cloud
        isLocal = false;
        activeClient = getClient(cloudUrl, cloudKey);
        console.log('☁️ CONNECTED: Using Cloud Supabase');
        localStorage.setItem('is_local_instance', 'false');
    }

    return { isLocal, url: isLocal ? localUrl : cloudUrl };
};

initSupabase();

/**
 * Returns a Supabase client scoped to the appropriate schema based on the user.
 * @param {object} user - The current logged-in user
 * @returns {object} - Supabase client
 */
export const getSupabase = (user) => {
    return supabase;
};

/**
 * NEW: Global helper to check if we are currently running local
 */
export const isLocalInstance = () => isLocal;