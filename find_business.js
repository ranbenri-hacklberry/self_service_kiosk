
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function findBusiness() {
    const { data: bData, error: bError } = await supabase
        .from('businesses')
        .select('*');

    if (bError) {
        console.error('Businesses Error:', bError);
    } else {
        console.log('--- BUSINESSES ---');
        console.table(bData);
    }

    const { data: sData, error: sError } = await supabase
        .from('business_secrets')
        .select('*');

    if (sError) {
        console.error('Business Secrets Error:', sError);
    } else {
        console.log('--- BUSINESS SECRETS ---');
        console.table(sData);
    }
}

findBusiness();
