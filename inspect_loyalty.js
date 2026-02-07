import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const REMOTE_URL = process.env.VITE_SUPABASE_URL;
const REMOTE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

const cloud = createClient(REMOTE_URL, REMOTE_KEY);

async function inspect() {
    console.log("🔍 Inspecting loyalty_transactions IDs...");
    const { data } = await cloud.rpc('get_loyalty_transactions_for_sync', { p_business_id: BUSINESS_ID }).range(0, 100);

    if (data) {
        const ids = data.map(r => r.id);
        const uniqueIds = new Set(ids);
        console.log(`Sample: ${ids.length} rows, ${uniqueIds.size} unique IDs`);
        console.log("First 5 IDs:", ids.slice(0, 5));
    } else {
        console.log("No data found.");
    }
}
inspect();
