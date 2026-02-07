
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findNatiSpecial() {
    const bizId = '11111111-1111-1111-1111-111111111111';
    console.log(`Checking ALL employees for business ${bizId}...`);

    // We try to use the rpc if we can, but since I'm using the anon key in some places it might fail.
    // Let's try direct select first.
    const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .eq('business_id', bizId);

    if (error) {
        console.error('Error fetching employees:', error);
        return;
    }

    console.log(`Total employees found: ${employees?.length || 0}`);
    console.log('Employees:', JSON.stringify(employees, null, 2));

    const nati = employees.find(e => e.name && (e.name.includes('נתי') || e.name.toLowerCase().includes('nati')));
    if (nati) {
        console.log('✅ Found Nati:', nati);
    } else {
        console.log('❌ Nati not found in the list.');
    }
}

findNatiSpecial();
