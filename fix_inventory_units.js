
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    const businessId = '22222222-2222-2222-2222-222222222222';

    // Items to fix: Lemonade, Apple Juice, Mango, Pralines
    const itemNames = ['לימונדה', 'מיץ תפוחים', 'מנגו קפוא', 'פרלינים'];

    const { data: items, error: fetchError } = await supabase
        .from('inventory_items')
        .select('id, name')
        .eq('business_id', businessId)
        .in('name', itemNames);

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        return;
    }

    const idsToFix = items.map(i => i.id);
    console.log('Fixing items:', idsToFix);

    const { error: updateError } = await supabase
        .from('inventory_items')
        .update({
            unit: 'יח׳',
            count_step: 1,
            weight_per_unit: 0
        })
        .in('id', idsToFix);

    if (updateError) {
        console.error('Update Error:', updateError);
    } else {
        console.log('Successfully updated items to Unit mode.');
    }
}

main();
