import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// קונפיגורציה
const REMOTE_URL = process.env.VITE_SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.VITE_LOCAL_SERVICE_ROLE_KEY || process.env.LOCAL_SUPABASE_SERVICE_KEY;

if (!REMOTE_URL || !REMOTE_KEY) {
    console.error('❌ Missing REMOTE credentials in .env');
    process.exit(1);
}
if (!LOCAL_KEY) {
    console.error('❌ Missing VITE_LOCAL_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const remoteSupabase = createClient(REMOTE_URL, REMOTE_KEY);
const localSupabase = createClient(LOCAL_URL, LOCAL_KEY);

// סדר נכון לפי FK dependencies
const TABLES_TO_SYNC = [
    // 1. טבלאות בסיס ללא תלויות
    'businesses',
    // 2. טבלאות שתלויות ב-business
    'inventory_items',
    'menu_items',
    'optiongroups',
    // 3. טבלאות שתלויות בטבלאות לעיל
    'optionvalues',
    'recipe_ingredients',
    // 4. טבלאות הזמנות (אופציונלי - ריקות בדרך כלל)
    'orders',
    'order_items'
];

async function syncTable(tableName, conflictColumn = 'id') {
    console.log(`🔄 Syncing table: ${tableName}...`);

    try {
        // 1. Fetch from Remote
        const { data: remoteData, error: fetchError } = await remoteSupabase
            .from(tableName)
            .select('*');

        if (fetchError) {
            console.error(`❌ Error fetching ${tableName}:`, fetchError.message, fetchError.details || '');
            return { success: false, rows: 0 };
        }

        if (!remoteData || remoteData.length === 0) {
            console.log(`ℹ️ Table ${tableName} is empty on remote.`);
            return { success: true, rows: 0 };
        }

        // 2. Upsert to Local (batch in chunks of 100)
        const chunkSize = 100;
        let totalUpserted = 0;

        for (let i = 0; i < remoteData.length; i += chunkSize) {
            const chunk = remoteData.slice(i, i + chunkSize);
            const { error: upsertError } = await localSupabase
                .from(tableName)
                .upsert(chunk, {
                    onConflict: conflictColumn,
                    ignoreDuplicates: false
                });

            if (upsertError) {
                console.error(`❌ Error upserting chunk to ${tableName}:`, upsertError.message);
                return { success: false, rows: totalUpserted };
            }
            totalUpserted += chunk.length;
        }

        console.log(`✅ ${tableName} synced successfully (${totalUpserted} rows).`);
        return { success: true, rows: totalUpserted };

    } catch (err) {
        console.error(`❌ Unexpected error syncing ${tableName}:`, err.message);
        return { success: false, rows: 0 };
    }
}

async function runSync() {
    console.log('🚀 Starting Initial Data Pull (Ordered by FK dependencies)...');
    console.log(`📡 Remote: ${REMOTE_URL}`);
    console.log(`🏠 Local: ${LOCAL_URL}\n`);

    const results = {};

    for (const table of TABLES_TO_SYNC) {
        results[table] = await syncTable(table);
    }

    console.log('\n📊 Sync Summary:');
    console.log('─'.repeat(40));
    for (const [table, result] of Object.entries(results)) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${table}: ${result.rows} rows`);
    }
    console.log('─'.repeat(40));
    console.log('🏁 Sync Finished!');
}

runSync();
