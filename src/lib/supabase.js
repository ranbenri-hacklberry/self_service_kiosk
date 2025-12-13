import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Returns a Supabase client scoped to the appropriate schema based on the user.
 * @param {object} user - The current logged-in user
 * @returns {object} - Supabase client with .schema() applied if needed
 */
export const getSupabase = (user) => {
    // Check if user is a demo user (by phone number for now, or a specific flag)
    // Demo Admin: 0500000000, Demo Staff: 0501111111
    const isDemoUser = user?.whatsapp_phone === '0500000000' || user?.whatsapp_phone === '0501111111';

    console.log('🔍 getSupabase Debug:', {
        phone: user?.whatsapp_phone,
        isDemoUser,
        schema: isDemoUser ? 'demo' : 'public'
    });

    if (isDemoUser) {
        return supabase.schema('demo');
    }

    return supabase;
};