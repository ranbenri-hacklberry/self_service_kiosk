
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to find .env file
const envPath = '/Users/user/.gemini/antigravity/scratch/my_app/frontend_source/.env';
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials missing in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPCs() {
    const businessId = 'a7e3168d-df46-45e6-be9e-0aaf18bb7f2c'; // Example ID from logs

    console.log(`\n🔍 Testing RPC: get_active_sales_dates for business ${businessId}...`);
    const { data: dates, error: datesError } = await supabase.rpc('get_active_sales_dates', {
        p_business_id: businessId
    });

    if (datesError) {
        console.error('❌ get_active_sales_dates Error:', datesError);
    } else {
        console.log('✅ get_active_sales_dates Data:', dates);
        console.log('Type:', typeof dates, Array.isArray(dates) ? '(Array)' : '(Object)');
    }

    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();

    console.log(`\n🔍 Testing RPC: get_sales_data for business ${businessId}...`);
    const { data: sales, error: salesError } = await supabase.rpc('get_sales_data', {
        p_business_id: businessId,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString()
    });

    if (salesError) {
        console.error('❌ get_sales_data Error:', salesError);
    } else {
        console.log('✅ get_sales_data returned', sales?.length || 0, 'orders');
        if (sales && sales.length > 0) {
            console.log('Sample Order Items Structure:', JSON.stringify(sales[0].order_items?.slice(0, 1), null, 2));
        }
    }
}

testRPCs();
