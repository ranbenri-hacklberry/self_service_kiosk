const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMenu() {
    const bizId = '11111111-1111-1111-1111-111111111111'; // עגלת קפה

    console.log('🚀 מתחיל עדכון מנות מותאם לעמודות הקיימות...');

    // 1. Update עיקריות, טוסטים וכריכים, מאפים
    const prepCategories = ['עיקריות', 'טוסטים וכריכים', 'מאפים'];
    const { error: prepError } = await supabase
        .from('menu_items')
        .update({
            is_prep_required: true,
            kds_routing_logic: 'MADE_TO_ORDER'
        })
        .eq('business_id', bizId)
        .in('category', prepCategories);

    if (prepError) console.error('❌ שגיאה בעדכון מנות הכנה:', prepError);
    else console.log(`✅ עודכנו מנות בקטגוריות: ${prepCategories.join(', ')}`);

    // 2. Update שתיה חמה - Ensure logic is MADE_TO_ORDER
    const { error: drinkError } = await supabase
        .from('menu_items')
        .update({
            is_prep_required: true,
            kds_routing_logic: 'MADE_TO_ORDER'
        })
        .eq('business_id', bizId)
        .eq('category', 'שתיה חמה');

    if (drinkError) console.error('❌ שגיאה בעדכון שתיה חמה:', drinkError);
    else console.log('✅ עודכנו מנות שתיה חמה ל-MADE_TO_ORDER');

    console.log('\n✨ העדכון הושלם!');
}

fixMenu();
