import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY || process.env.VITE_LOCAL_SERVICE_ROLE_KEY;

const local = createClient(LOCAL_URL, LOCAL_KEY);

async function inspectSyncQueue() {
    console.log("🔍 Inspecting 'sync_queue' table...");
    const { data, error } = await local.from('sync_queue').select('*').limit(10);
    if (error) {
        console.error("Error fetching sync_queue:", error);
    } else {
        console.log("Data in sync_queue:", JSON.stringify(data, null, 2));
    }
}
inspectSyncQueue();
