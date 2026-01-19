import { createClient } from '@supabase/supabase-js';

// Config
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkOwner() {
    console.log('Checking owner_name for Demo Business (2222...)...');

    const DEMO_ID = '22222222-2222-2222-2222-222222222222';

    const { data, error } = await supabase
        .from('businesses')
        .select('id, name, owner_name, sms_number')
        .eq('id', DEMO_ID)
        .single();

    if (error) {
        console.error('Error fetching:', error);
    } else {
        console.log('Found Data:', data);
    }
}

checkOwner();
