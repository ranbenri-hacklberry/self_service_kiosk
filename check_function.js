
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkFunction() {
    console.log('Fetching submit_order_v3 definition...');
    const { data, error } = await supabase.rpc('get_function_def', {
        function_name: 'submit_order_v3'
    });

    if (error) {
        // If helper RPC doesn't exist, try querying pg_proc
        console.log('get_function_def failed, trying direct query if possible...');
        const { data: proc, error: procError } = await supabase
            .from('pg_proc')
            .select('*')
            .ilike('proname', 'submit_order_v3');

        if (procError) {
            console.error('Query failed:', procError);
        } else {
            console.log('Proc info:', proc);
        }
    } else {
        console.log('Function definition:', data);
    }
}

checkFunction();
