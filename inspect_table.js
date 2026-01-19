import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log('Fetching businesses...');
    const { data, error } = await supabase.from('businesses').select('*').limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Columns in `businesses`:', data && data.length > 0 ? Object.keys(data[0]) : 'No rows found');
        console.log('Sample row:', data);
    }
}

inspect();
