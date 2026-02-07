
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, current_stock, unit, weight_per_unit, count_step, category')
        .eq('business_id', '22222222-2222-2222-2222-222222222222')
        .or('name.ilike.%חלב%,name.ilike.%לימונדה%,name.ilike.%תפוח%,name.ilike.%מנגו%,name.ilike.%פרלין%');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Items:', JSON.stringify(data, null, 2));
    }
}

main();
