
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxzsxvbercpkgxraiaex.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g'
);

async function checkBiz2222Menu() {
    const bizId = '22222222-2222-2222-2222-222222222222';
    console.log(`Checking menu for Biz ${bizId}...`);

    const { data: menu } = await supabase
        .from('menu_items')
        .select('id, name, is_hot_drink')
        .eq('business_id', bizId);

    console.log('Menu Items Count:', menu?.length);
    if (menu && menu.length > 0) {
        console.log('Sample Menu Items:', menu.slice(0, 5));
    }
}

checkBiz2222Menu();
