import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('🚨 CRITICAL ERROR: Supabase Environment Variables are missing!');
    console.error('Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel Project Settings.');
    throw new Error('Supabase Environment Variables Missing. Check Console.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Returns a Supabase client scoped to the appropriate schema based on the user.
 * @param {object} user - The current logged-in user
 * @returns {object} - Supabase client with .schema() applied if needed
 */
export const getSupabase = (user) => {
    // Legacy logic removed: We now use Single Schema (public) with Business ID filtering.
    // The previous logic attempted to switch to 'demo' schema, causing 406 errors.
    return supabase;
};