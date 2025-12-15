
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
    const { data: categories, error } = await supabase
        .from('menu_items')
        .select('category')
        .not('category', 'is', null);

    if (error) {
        console.error(error);
        return;
    }

    // Count unique categories
    const counts = {};
    categories.forEach(c => {
        counts[c.category] = (counts[c.category] || 0) + 1;
    });

    console.table(counts);
}

checkCategories();
