import { createClient } from '@supabase/supabase-js';

// Config from .env (re-verified)
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAndPopulate() {
    console.log('Checking for owner_name column...');

    // Try to select owner_name
    const { data, error } = await supabase.from('businesses').select('owner_name').limit(1);

    if (error) {
        console.log('Column probably missing or RLS issue:', error.message);
        console.log('Please run the `update_owner_name.sql` script in your Supabase Dashboard.');
        return;
    }

    console.log('Column exists! Populating data...');

    // Fetch all businesses
    const { data: businesses } = await supabase.from('businesses').select('id, name');

    for (const biz of businesses) {
        let owner = 'מנהל';
        if (biz.id.startsWith('11111') || biz.name.includes('שפת') || biz.name.includes('עגלת')) {
            owner = 'נתי';
        }

        console.log(`Setting owner for ${biz.name} to '${owner}'...`);

        const { error: updateError } = await supabase
            .from('businesses')
            .update({ owner_name: owner })
            .eq('id', biz.id);

        if (updateError) console.error('Error updating:', updateError.message);
    }
    console.log('Done.');
}

checkAndPopulate();
