
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findMidbar() {
    const { data: businesses, error } = await supabase
        .from('businesses')
        .select('id, name')
        .ilike('name', '%עגלת%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Businesses:', JSON.stringify(businesses, null, 2));

    if (businesses && businesses.length > 0) {
        const { data: employees, error: err2 } = await supabase
            .from('employees')
            .select('id, name, business_id, access_level')
            .eq('business_id', businesses[0].id);
        
        console.log('Employees:', JSON.stringify(employees, null, 2));
    }
}

findMidbar();
