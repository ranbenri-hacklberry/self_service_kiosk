
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findNati() {
    const { data: employees, error } = await supabase
        .from('employees')
        .select('id, name, business_id, access_level')
        .ilike('name', '%נתי%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Results:', JSON.stringify(employees, null, 2));
}

findNati();
