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

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyNewData() {
    console.log('🔍 Checking new schema columns and data...');

    // 1. Check recurring_tasks columns logic
    // 1a. Check recurring_tasks BASE (schedule)
    console.log('\n--- Recurring Tasks Base Check ---');
    const { data: taskData, error: taskError } = await supabase
        .from('recurring_tasks')
        .select('id, name, weekly_schedule, logic_type')
        .limit(3);

    if (taskError) {
        console.log('❌ Failed to fetch schedule cols:', taskError.message);
    } else {
        console.log('✅ Base columns (weekly_schedule) EXIST.');
    }

    // 1b. Check recurring_tasks NEW (pre_closing)
    console.log('\n--- Recurring Tasks Pre-Closing Check ---');
    const { error: preClosingError } = await supabase
        .from('recurring_tasks')
        .select('is_pre_closing')
        .limit(1);

    if (preClosingError) console.log('❌ Column is_pre_closing MISSING.');
    else console.log('✅ Column is_pre_closing EXISTS.');

    // 2. Check businesses columns
    console.log('\n--- Businesses Timing Check ---');
    // We try to fetch any business just to check columns
    const { data: busData, error: busError } = await supabase
        .from('businesses')
        .select('id, opening_tasks_start_time, closing_tasks_start_time')
        .limit(1);

    if (busError) {
        console.error('❌ Failed to fetch businesses:', busError.message);
    } else {
        console.log('✅ Fetched businesses successfully.');
        if (busData.length > 0) {
            console.log('   Business Settings:', busData[0]);
        } else {
            console.log('   No business found (check RLS or data existence).');
        }
    }

    // 3. Check task_completions table existence
    console.log('\n--- Task Completions Table Check ---');
    const { data: compData, error: compError } = await supabase
        .from('task_completions')
        .select('id')
        .limit(1);

    if (compError) {
        // If table doesn't exist, error code is usually '42P01' (undefined_table) but via API it might be generic
        console.error('❌ Failed to fetch task_completions:', compError.message);
    } else {
        console.log('✅ task_completions table exists.');
        console.log(`   Rows found: ${compData.length}`);
    }
}

verifyNewData();
