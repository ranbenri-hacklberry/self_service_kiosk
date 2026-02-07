
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findNatiAndBusiness() {
    console.log('Searching for Nati in all employees...');
    const { data: employees, error: eErr } = await supabase
        .from('employees')
        .select(`
            id, 
            name, 
            business_id, 
            access_level,
            businesses(id, name)
        `)
        .ilike('name', '%נתי%');

    if (eErr) {
        console.error('Error fetching employees:', eErr);
    } else {
        console.log('Nati(s) found:', JSON.stringify(employees, null, 2));
    }

    console.log('Searching for business starting with 111...');
    // Since we can't ilike a UUID, let's search by string conversion if possible, 
    // or just fetch all businesses and filter locally if there aren't too many.
    const { data: allBiz, error: bErr } = await supabase
        .from('businesses')
        .select('id, name');

    if (bErr) {
        console.error('Error fetching businesses:', bErr);
    } else {
        const targetBiz = allBiz.filter(b => b.id.startsWith('111'));
        console.log('Businesses starting with 111:', targetBiz);
    }
}

findNatiAndBusiness();
