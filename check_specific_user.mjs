import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserBusiness() {
    console.log('🔍 Checking User Association for ran@mail.com...');

    const { data: employees, error } = await supabase
        .from('employees')
        .select(`
            id, 
            name, 
            email, 
            business_id,
            business:businesses(name)
        `)
        .eq('email', 'ran@mail.com');

    if (error) {
        console.error('❌ Error finding user:', error.message);
        return;
    }

    if (!employees || employees.length === 0) {
        console.error('❌ User ran@mail.com NOT FOUND in employees table.');
        return;
    }

    employees.forEach(emp => {
        console.log(`\n👤 User Found: ${emp.name}`);
        console.log(`   ID: ${emp.id}`);
        console.log(`   Business ID: ${emp.business_id}`);
        // @ts-ignore
        console.log(`   Business Name: ${emp.business?.name || 'Unknown'}`);
    });
}

checkUserBusiness();
