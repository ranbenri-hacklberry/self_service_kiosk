import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*, businesses(name, id)')
        .eq('email', 'ranbenri@gmail.com');

    if (empError) {
        console.error('❌ Error fetching employee:', empError.message);
    } else {
        console.log('👷 Employee Records found:', employees.length);
        employees.forEach(e => {
            console.log(`- ${e.name}: BizID=${e.business_id}, BizName=${e.businesses?.name}, Role=${e.role}`);
        });
    }
}

check();
