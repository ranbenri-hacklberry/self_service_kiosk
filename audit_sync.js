import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const REMOTE_URL = process.env.VITE_SUPABASE_URL;
const REMOTE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY;
const BUSINESS_ID = "11111111-1111-1111-1111-111111111111";

const cloud = createClient(REMOTE_URL, REMOTE_KEY);
const docker = createClient(LOCAL_URL, LOCAL_KEY);

const TABLES = [
    'employees', 'menu_items', 'customers', 'orders', 'order_items',
    'loyalty_cards', 'loyalty_transactions', 'inventory_items'
];

async function getDeepCloudCount(table) {
    if (['loyalty_cards', 'loyalty_transactions', 'customers'].includes(table)) {
        const rpcName = table === 'customers' ? 'get_customers_for_sync' :
            table === 'loyalty_cards' ? 'get_loyalty_cards_for_sync' : 'get_loyalty_transactions_for_sync';
        let total = 0;
        let page = 0;
        while (true) {
            const { data } = await cloud.rpc(rpcName, { p_business_id: BUSINESS_ID }).range(page * 1000, (page + 1) * 1000 - 1);
            if (!data || data.length === 0) break;
            total += data.length;
            if (data.length < 1000) break;
            page++;
        }
        return total;
    }

    if (table === 'order_items') {
        // Get all orders first
        let allOrderIds = [];
        let page = 0;
        while (true) {
            const { data } = await cloud.from('orders').select('id').eq('business_id', BUSINESS_ID).range(page * 1000, (page + 1) * 1000 - 1);
            if (!data || data.length === 0) break;
            allOrderIds.push(...data.map(o => o.id));
            if (data.length < 1000) break;
            page++;
        }

        // Now count items for these orders in batches
        let itemTotal = 0;
        for (let i = 0; i < allOrderIds.length; i += 100) {
            const { count } = await cloud.from('order_items').select('*', { count: 'exact', head: true }).in('order_id', allOrderIds.slice(i, i + 100));
            itemTotal += (count || 0);
        }
        return itemTotal;
    }

    const { count } = await cloud.from(table).select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID);
    return count || 0;
}

async function getDockerCount(table) {
    const { count } = await docker.from(table).select('*', { count: 'exact', head: true }).eq('business_id', BUSINESS_ID);
    return count || 0;
}

async function run() {
    console.log("🕵️ Detailed Parity Audit...");
    const results = [];
    for (const table of TABLES) {
        const c = await getDeepCloudCount(table);
        const d = await getDockerCount(table);
        results.push({ table, cloud: c, docker: d, diff: c - d });
    }
    console.table(results);
}
run();
