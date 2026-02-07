import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateEspressoModifiers() {
    console.log("☕ Starting Espresso Modifiers Update...");

    const ESPRESSO_ID = 255;

    // Simulate the exact modifier structure used in the frontend
    const espressoModifiers = [
        {
            name: "סוג אספרסו",
            requirement: "M", // Mandatory
            logic: "R",      // Replace (Radio)
            minSelection: 1,
            maxSelection: 1,
            items: [
                { name: "קצר", price: 0, isDefault: true },
                { name: "ארוך", price: 0, isDefault: false }
            ]
        }
    ];

    console.log("📡 Syncing to Supabase for ID 255...");

    try {
        const { data, error } = await supabase
            .from('menu_items')
            .update({ modifiers: espressoModifiers })
            .eq('id', ESPRESSO_ID)
            .select();

        if (error) {
            console.error("❌ UPDATE FAILED:", error.message);
            return;
        }

        console.log("✅ Update successful. Verified Data:");
        console.log(JSON.stringify(data[0].modifiers, null, 2));

        if (data[0].modifiers.length > 0) {
            console.log("✨ SUCCESS: Modifiers 'קצר' and 'ארוך' are now in the DB for Espresso.");
        }

    } catch (e) {
        console.error("💥 Script error:", e);
    }
}

updateEspressoModifiers();
