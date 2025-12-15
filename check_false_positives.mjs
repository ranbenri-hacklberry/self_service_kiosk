
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkCategories() {
    console.log('Checking categories of items marked as hot drinks...');

    const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, category, is_hot_drink')
        .eq('is_hot_drink', true);

    if (error) {
        console.log('Error:', error.message);
    } else {
        console.log('Items currently marked as hot drinks:');
        data.forEach(item => {
            console.log(`[${item.id}] ${item.name} (${item.category})`);
        });
    }
}

checkCategories().catch(console.error);
