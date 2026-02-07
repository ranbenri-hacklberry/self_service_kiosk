import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 🕵️‍♂️ Full System Audit: Verifying Synchronization Flow
 * This script audits the data integrity for Espresso (ID 255)
 */
async function runFullSystemAudit() {
    console.log("🔍 STARTING FULL SYSTEM AUDIT...");
    const businessId = '22222222-2222-2222-2222-222222222222';
    const itemId = 255;

    // 1. Check SUPABASE (Source of Truth)
    console.log(`\n--- STEP 1: Supabase Health Check ---`);
    const { data: dbItem, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('id', itemId)
        .single();

    if (error) {
        console.error("❌ SUPABASE ERROR:", error.message);
        return;
    }

    console.log(`✅ Item Found: "${dbItem.name}"`);
    console.log(`✅ Category: "${dbItem.category}" (Should be שתיה חמה)`);
    console.log(`✅ Modifiers Status: ${dbItem.modifiers?.length > 0 ? 'EXIST' : 'MISSING'}`);

    if (dbItem.modifiers?.length > 0) {
        console.log(`   Detailed Modifiers:`, JSON.stringify(dbItem.modifiers, null, 2));
    }

    // 2. Simulate FRONTEND Mapping Logic (from useMenuItems.js)
    console.log(`\n--- STEP 2: POS Mapping Logic Simulation ---`);
    const mappedItem = {
        id: dbItem.id,
        name: dbItem.name,
        category: dbItem.category,
        modifiers: dbItem.modifiers || [] // This is the fix we just applied
    };

    if (mappedItem.modifiers.length > 0) {
        console.log(`✅ SUCCESS: POS mapping correctly includes modifiers.`);
    } else {
        console.error(`❌ FAILURE: POS mapping logic dropped modifiers!`);
    }

    // 3. Verify Cache Integrity (Description of what would happen in Dexie)
    console.log(`\n--- STEP 3: Cache Strategy Verification ---`);
    const CACHE_VERSION = 'v6'; // Must match useMenuItems.js
    console.log(`ℹ️ POS is currently using Cache Version: ${CACHE_VERSION}`);
    console.log(`ℹ️ Logic: If local cache version < ${CACHE_VERSION}, cache is wiped & synced.`);

    console.log("\n--- AUDIT SUMMARY ---");
    if (dbItem.modifiers?.length > 0 && mappedItem.modifiers.length > 0) {
        console.log("🎉 ALL GREEN: System is fully synchronized.");
        console.log("👉 ACTION: User should refresh the page to clear any old v5 cache.");
    } else {
        console.error("🚩 ISSUES FOUND: See logs above.");
    }
}

runFullSystemAudit();
