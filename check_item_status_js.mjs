
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkStatus() {
    // Try to insert a dummy item with 'ready' status to see if it fails
    // Actually, better to just check one item
    const { data, error } = await supabase
        .from('order_items')
        .select('item_status')
        .limit(1);

    if (data) {
        console.log('Sample item status:', data[0].item_status);
    }

    // Try to update one item to 'ready' (we'll rollback or it's a test)
    // We won't actually do it to avoid messing up data, but we can assume 'ready' is valid if 'order_status' has it.
    // Usually they share semantics or are text.

    // Let's check if we can find any item with 'ready' status
    const { data: readyItems } = await supabase
        .from('order_items')
        .select('id')
        .eq('item_status', 'ready')
        .limit(1);

    console.log('Items with status "ready":', readyItems?.length || 0);
}

checkStatus().catch(console.error);
