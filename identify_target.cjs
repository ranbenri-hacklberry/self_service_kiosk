
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findMidbarAndNati() {
    console.log('Searching for business starting with 2222...');
    const { data: businesses, error: bErr } = await supabase
        .from('businesses')
        .select('id, name')
        .ilike('id', '2222%');

    if (bErr) {
        console.error('Error fetching businesses:', bErr);
    } else {
        console.log('Businesses found:', businesses);
    }

    console.log('Searching for Nati in employees...');
    const { data: employees, error: eErr } = await supabase
        .from('employees')
        .select('id, name, business_id, access_level')
        .ilike('name', '%נתי%');

    if (eErr) {
        console.error('Error fetching employees:', eErr);
    } else {
        console.log('Employees found:', employees);
    }
}

findMidbarAndNati();
