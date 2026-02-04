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

// PRODUCTION CHECK: If we are on Vercel or any non-local hostname, ALWAYS use cloud. No exceptions.
const isProduction = window.location.hostname.includes('vercel.app') ||
    window.location.hostname.includes('.com') ||
    window.location.hostname.includes('.co.il') ||
    (!window.location.hostname.startsWith('192.168.') &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1');

// Only consider local if explicitly on localhost/127.0.0.1/192.168.x AND not production
const isLikelyLocal = !isProduction && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.') ||
    window.location.search.includes('local=true')
);

// Initialize client immediately - CLOUD for production, LOCAL only for dev
activeClient = createClient(isLikelyLocal ? localUrl : cloudUrl, isLikelyLocal ? localKey : cloudKey, {
    auth: { storage: window.localStorage }
});
isLocal = isLikelyLocal;

console.log(`🚀 Supabase Init: ${isProduction ? '☁️ PRODUCTION (Cloud Only)' : (isLikelyLocal ? '🏠 LOCAL MODE' : '☁️ CLOUD')}`);

export const supabase = new Proxy({}, {
    get: (target, prop) => activeClient[prop]
});

export const initSupabase = async () => {
    // If we're in production, skip all local checks entirely
    if (isProduction) {
        isLocal = false;
        activeClient = getClient(cloudUrl, cloudKey);
        console.log('☁️ CONNECTED: Using Cloud Supabase (Production Mode)');
        localStorage.setItem('is_local_instance', 'false');
        return { isLocal: false, url: cloudUrl };
    }

    // Only for local development: try to connect to local Supabase
    if (isLikelyLocal) {
        try {
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
                // Local failed - fall back to cloud for dev
                console.warn('⚠️ Local Supabase unreachable, falling back to Cloud');
                isLocal = false;
                activeClient = getClient(cloudUrl, cloudKey);
                localStorage.setItem('is_local_instance', 'false');
            }
        } catch (e) {
            console.warn('⚠️ Local connection failed, falling back to Cloud:', e.message);
            isLocal = false;
            activeClient = getClient(cloudUrl, cloudKey);
            localStorage.setItem('is_local_instance', 'false');
        }
    } else {
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