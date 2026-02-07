
import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const REMOTE_URL = process.env.VITE_SUPABASE_URL;
const REMOTE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY;

const supabase = createClient(REMOTE_URL, REMOTE_KEY);

async function findNati() {
    const { data: employees, error } = await supabase
        .from('employees')
        .select('*, businesses(name)')
        .ilike('name', '%נתי%')
        .eq('business_id', '22222222-2222-2222-2222-222222222222'); // Assuming this is the placeholder ID

    if (error) {
        // If the exact ID fails, just search by name
        const { data: allNati, error: err2 } = await supabase
            .from('employees')
            .select('*, businesses(name)')
            .ilike('name', '%נתי%');

        console.log("Results for 'Nati' search:", JSON.stringify(allNati, null, 2));
        return;
    }

    console.log("Found Nati in business 2222:", JSON.stringify(employees, null, 2));
}

findNati();
