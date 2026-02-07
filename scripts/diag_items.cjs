const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://gxzsxvbercpkgxraiaex.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4enN4dmJlcmNwa2d4cmFpYWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjMyNzAsImV4cCI6MjA3NzEzOTI3MH0.6sJ7PJ2imo9-mzuYdqRlhQty7PCQAzpSKfcQ5ve571g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: businesses } = await supabase.from('businesses').select('id, name');
    console.log('All Businesses:', businesses);

    const biz = businesses.find(b => b.name.includes('עגלת קפה'));
    if (!biz) { console.log('Business not found'); return; }
    console.log('Found Business:', biz.name, '| ID:', biz.id);

    const { data: categories } = await supabase
        .from('menu_items')
        .select('category')
        .eq('business_id', biz.id);

    const uniqueCategories = [...new Set(categories.map(c => c.category))];
    console.log('Available Categories:', uniqueCategories);

    const { data: items } = await supabase
        .from('menu_items')
        .select('id, name, category, is_prep_required, requires_prep, show_on_kds')
        .eq('business_id', biz.id)
        .limit(50);

    console.log('\nSample items:');
    items.forEach(i => {
        console.log(`- ${i.name} | Cat: ${i.category} | Prep: ${i.requires_prep}/${i.is_prep_required} | KDS: ${i.show_on_kds}`);
    });
}

check().catch(e => console.error(e));
