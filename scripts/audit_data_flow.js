import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugDataFlow() {
    console.log("🚀 Starting Data Flow Simulation (Node.js)...");

    const testBusinessId = "22222222-2222-2222-2222-222222222222"; // From user logs
    const testItemName = "Node Debug Burger " + Date.now();

    // 1. Simulate the data object exactly as prepared in useOnboardingStore
    const testModifiers = [{
        name: "Extra Sauce Group",
        requirement: "O",
        logic: "A",
        minSelection: 0,
        maxSelection: 5,
        items: [{ name: "Ketchup", price: 2 }, { name: "Mayo", price: 0 }]
    }];

    const dbItem = {
        business_id: testBusinessId,
        name: testItemName,
        category: "Debug",
        description: "Test item from Node audit script",
        price: 99,
        modifiers: testModifiers, // This is the payload we are testing
        is_visible_pos: true,
        is_visible_online: true,
        kds_station: 'kitchen'
    };

    console.log("📡 Sending upsert to Supabase...");

    try {
        const { data, error } = await supabase
            .from('menu_items')
            .insert([dbItem])
            .select();

        if (error) {
            console.error("❌ SUPABASE ERROR:", error.message);
            console.error("Details:", error.details);
            console.error("Hint:", error.hint);
            return;
        }

        const createdItem = data[0];
        console.log("✅ Row created with ID:", createdItem.id);

        // 2. Immediate Re-fetch to verify storage
        console.log("🔍 Re-fetching item to verify JSONB storage...");
        const { data: verified, error: fetchError } = await supabase
            .from('menu_items')
            .select('id, name, modifiers')
            .eq('id', createdItem.id)
            .single();

        if (fetchError) {
            console.error("❌ Fetch failed:", fetchError.message);
        } else {
            console.log("📊 Result from DB:", JSON.stringify(verified, null, 2));

            if (verified.modifiers && verified.modifiers.length > 0) {
                console.log("✨ SUCCESS: Modifiers saved and retrieved correctly!");
            } else {
                console.error("🔥 CRITICAL: Modifiers column is EMPTY in DB despite being sent!");
            }
        }

        // 3. Clean up
        console.log("🧹 Cleaning up test item...");
        await supabase.from('menu_items').delete().eq('id', createdItem.id);
        console.log("Done.");

    } catch (e) {
        console.error("💥 Execution failed:", e);
    }
}

debugDataFlow();
