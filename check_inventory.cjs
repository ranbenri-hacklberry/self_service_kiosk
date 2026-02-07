
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: businesses } = await supabase.from('businesses').select('id, name').ilike('name', '%icaffe%');
    console.log('Businesses:', businesses);
    if (businesses && businesses.length > 0) {
        for (const b of businesses) {
            const { count } = await supabase.from('inventory_items').select('*', { count: 'exact', head: true }).eq('business_id', b.id);
            console.log(`Business ${b.name} (${b.id}) has ${count} inventory items.`);
        }
    }
}
check();
