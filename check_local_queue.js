import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY || process.env.VITE_LOCAL_SERVICE_ROLE_KEY;

const local = createClient(LOCAL_URL, LOCAL_KEY);

async function checkQueue() {
    console.log("🔍 Checking for sync queue tables in Docker...");
    const { data, error } = await local.from('offline_queue').select('*').limit(1);
    if (error) {
        console.log("❌ 'offline_queue' does not exist in Docker.");
    } else {
        console.log("✅ 'offline_queue' exists!");
    }

    const { data: d2, error: e2 } = await local.from('sync_queue').select('*').limit(1);
    if (e2) {
        console.log("❌ 'sync_queue' does not exist in Docker.");
    } else {
        console.log("✅ 'sync_queue' exists!");
    }
}
checkQueue();
