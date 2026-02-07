
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findMidbarAndNati() {
    console.log('Searching for business by name like Coffee...');
    const { data: businesses, error: bErr } = await supabase
        .from('businesses')
        .select('id, name')
        .or('name.ilike.%עגלת%,name.ilike.%מדבר%');

    if (bErr) {
        console.error('Error fetching businesses:', bErr);
        return;
    }

    console.log('Businesses found:', businesses);

    if (businesses && businesses.length > 0) {
        for (const biz of businesses) {
            console.log(`Checking employees for ${biz.name} (${biz.id})...`);
            const { data: employees, error: eErr } = await supabase
                .from('employees')
                .select('id, name, business_id, access_level')
                .eq('business_id', biz.id);

            if (eErr) {
                console.error(`Error fetching employees for ${biz.name}:`, eErr);
            } else {
                console.log(`Employees in ${biz.name}:`, employees);
            }
        }
    }
}

findMidbarAndNati();
