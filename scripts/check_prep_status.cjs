const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const bizId = '11111111-1111-1111-1111-111111111111'; // עגלת קפה

    const { data: items, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('business_id', bizId);

    if (error) { console.error(error); return; }

    const categories = ['עיקריות', 'מאפים', 'טוסטים וכריכים', 'שתיה חמה'];

    console.log('\n=== סטטוס מנות לעסק: עגלת קפה ===\n');

    categories.forEach(cat => {
        const catItems = items.filter(i => i.category === cat);
        console.log(`\n📂 ${cat.toUpperCase()}`);
        console.log('-'.repeat(100));

        catItems.forEach(item => {
            // Check all possible "prep" fields
            const requiresPrep = item.requires_prep;
            const isPrepRequired = item.is_prep_required;
            const kdsLogic = item.kds_routing_logic; // MADE_TO_ORDER, HYBRID, etc.

            const isActuallyPrep = (requiresPrep || isPrepRequired || kdsLogic === 'MADE_TO_ORDER');

            const prepStatus = isActuallyPrep ? '✅ דורש הכנה' : '❌ Grab & Go';
            const kdsStatus = item.show_on_kds ? '✅ ב-KDS' : '❌ לא ב-KDS';
            const invType = item.inventory_settings?.prepType || 'N/A';

            console.log(`${item.name.padEnd(30)} | ${prepStatus.padEnd(15)} | ${kdsStatus.padEnd(10)} | Logic: ${String(kdsLogic).padEnd(15)} | type: ${invType}`);
        });
    });
}
check();
