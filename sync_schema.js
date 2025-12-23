import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const remoteUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const remoteKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
const localUrl = 'http://127.0.0.1:54321';
const localKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

console.log('Remote URL:', remoteUrl);
console.log('Connecting...');

const remote = createClient(remoteUrl, remoteKey);
const local = createClient(localUrl, localKey);

// Get schema from remote
const { data, error } = await remote.rpc('get_schema_info', {});
if (error) {
    console.log('No RPC available, trying direct query...');
    // Try getting table list
    const { data: tables, error: tableErr } = await remote
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
    console.log('Tables:', tables || tableErr);
}
console.log('Schema info:', data || error);
