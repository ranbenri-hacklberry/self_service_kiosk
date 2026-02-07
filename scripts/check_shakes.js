
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env from root
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Loading .env from: ${envPath}`);
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

// Config
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials. Checked VITE_SUPABASE_URL/ANON_KEY.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShakes() {
    console.log("🔍 Searching for 'Coffee Cart' (עגלת קפה) business...");

    // 1. Find Business
    const { data: businesses, error: busError } = await supabase
        .from('businesses')
        .select('id, name')
        .or('name.ilike.%cart%,name.ilike.%עגלת%,name.ilike.%קפה%');

    if (busError) {
        console.error("❌ Business fetch error:", busError);
        return;
    }

    // Filter logic if needed, or interactive? 
    // I'll assume the one with "עגלת" is target if multiple.
    const targetBusiness = businesses.find(b => b.name.includes('עגלת')) || businesses[0];

    if (!targetBusiness) {
        console.log("❌ No relevant business found.");
        return;
    }

    console.log(`🏢 Found Business: ${targetBusiness.name} [ID: ${targetBusiness.id}]`);

    // 2. Find "Shake" items for this business
    console.log(`🔍 Searching for Shake items...`);
    const { data: items, error: itemError } = await supabase
        .from('menu_items')
        .select('id, name')
        .eq('business_id', targetBusiness.id)
        .or('name.ilike.%שייק%,name.ilike.%Shake%');

    if (itemError) {
        console.error("❌ Item fetch error:", itemError);
        return;
    }

    if (items.length === 0) {
        console.log("❌ No Shake items found.");
        return;
    }

    console.log(`🥤 Found ${items.length} Shake items: ${items.map(i => i.name).join(', ')}`);

    // 3. Find Option Groups attached
    const itemIds = items.map(i => i.id);
    const { data: links, error: linkError } = await supabase
        .from('menuitemoptions')
        .select('group_id')
        .in('item_id', itemIds);

    if (linkError) { console.error("Link error:", linkError); return; }

    const groupIds = [...new Set(links.map(l => l.group_id))];

    if (groupIds.length === 0) {
        console.log("❌ No option groups attached to these shakes.");
        return;
    }

    // 4. Get Values
    const { data: groups, error: grpError } = await supabase
        .from('optiongroups')
        .select('id, name')
        .in('id', groupIds);

    const { data: values, error: valError } = await supabase
        .from('optionvalues')
        .select('group_id, value_name, price_adjustment')
        .in('group_id', groupIds);

    // Report
    console.log("\n📋 Shake Add-ons Report:");
    groups.forEach(g => {
        console.log(`\n🔹 Group: ${g.name} [ID: ${g.id}]`);
        const myValues = values.filter(v => v.group_id === g.id);
        if (myValues.length === 0) {
            console.log("    (No values)");
        } else {
            myValues.forEach(v => {
                console.log(`    - ${v.value_name} (+${v.price_adjustment})`);
            });

            // Check missing
            const hasSoy = myValues.some(v => v.value_name.includes('סויה') || v.value_name.toLowerCase().includes('soy'));
            const hasOat = myValues.some(v => v.value_name.includes('שיבולת') || v.value_name.toLowerCase().includes('oat'));

            if (!hasSoy && !hasOat) console.log("    ⚠️ MISSING: Soy & Oat");
            else if (!hasSoy) console.log("    ⚠️ MISSING: Soy");
            else if (!hasOat) console.log("    ⚠️ MISSING: Oat");
            else console.log("    ✅ Contains Soy & Oat");
        }
    });
}

checkShakes().catch(console.error);
