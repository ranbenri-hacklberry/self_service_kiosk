import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

const COFFEE_CART_ID = '11111111-1111-1111-1111-111111111111';

// Seed image - The ONLY style source: Clear tall plastic cup, rustic wood, desert-botanical blur.
const SEED_IMAGE_PATH = 'public/cafe-images/item_22_קפה קר.png';
let base64Seed = null;
try {
    const seedData = fs.readFileSync(path.resolve(SEED_IMAGE_PATH));
    base64Seed = seedData.toString('base64');
} catch (e) {
    console.error("❌ CRITICAL: Seed image missing.");
    process.exit(1);
}

const ITEMS_TO_REGENERATE = [
    { name: 'שוקו קר', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup filled with ice and milk, with HEAVY dark chocolate syrup swirls on internal walls.' },
    { name: 'לימונדה', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with lemonade and lemon slices inside. Filled with ice.' },
    { name: 'תפוזים', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with fresh orange juice. Filled with ice.' },
    { name: 'תפוחים', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with DARK OPAQUE COLD-PRESSED APPLE JUICE. Filled with ice.' },
    { name: 'אייסקפה', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup filled with brown coffee slush (granita). Frozen crystalline texture. NO ICE CUBES.' },
    { name: 'ברד ענבים', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup filled with purple grape slush. Frozen crystalline texture. NO ICE CUBES.' },
    { name: 'מילקשייק', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with thick creamy milkshake. No ice.' },
    { name: 'שייק אדום', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with thick red fruit smoothie. No ice.' },
    { name: 'שייק צהוב', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with thick yellow fruit smoothie. No ice.' },
    { name: 'קפה קר', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with iced latte. Filled with ice.' },
    { name: 'אמריקנו קר', logic: 'MATCH CUP FROM REFERENCE. Tall clear disposable plastic cup with dark black coffee. Filled with ice.' },
    { name: 'פחית', logic: 'A standard colorful aluminum soda can, cold with condensation. NO CUP. NO GLASS.' },
    { name: 'פחית קטנה', logic: 'A small slim aluminum soda can, cold with condensation. NO CUP. NO GLASS.' },
    { name: 'טרופית', logic: 'An Israeli "Tropit" (juice pouch) with its classic straw inserted. NO CUP. NO GLASS.' },
    { name: 'בקבוק', logic: 'A cold plastic water/soda bottle with condensation. NO CUP. NO GLASS.' }
];

async function finalAestheticFix() {
    console.log("🌵 Starting FINAL Jordan Valley Botanical Fix...");

    const model = genAI.getGenerativeModel({
        model: "gemini-3-pro-image-preview",
        generationConfig: { responseModalities: ["image", "text"] }
    });

    for (const target of ITEMS_TO_REGENERATE) {
        const { data: items } = await supabase
            .from('menu_items')
            .select('*')
            .eq('business_id', COFFEE_CART_ID)
            .ilike('name', `%${target.name}%`)
            .eq('category', 'שתיה קרה');

        if (!items || items.length === 0) continue;

        const item = items[0];
        console.log(`🎨 Generating ${item.name}...`);

        const prompt = `PRODUCT PHOTOGRAPHY for a cafe in the Jordan Valley desert (בקעת הירדן).
**SUBJECT:** "${item.name}"
**PRESENTATION:** ${target.logic}
**SURFACE:** Placed on the EXACT RUSTIC WOODEN TABLE from the reference.
**BACKGROUND:** MATCH THE REFERENCE STYLE EXACTLY. A very blurred (bokeh) background of desert-botanical flora (palms, desert shrubs, dry greenery, Jordan Valley garden). NO tropical jungle. Warm, golden natural sunlight.
**COMPOSITION:** ITEM CENTERED PERFECTLY VERTICALLY AND HORIZONTALLY.
**STRICT:** NO mint leaves, NO external straws (unless it is a Tropit), NO napkins, NO cookies. ABSOLUTELY NO GLASS CUPS - ONLY disposable plastic cups matching reference or cans.`;

        try {
            const contents = [
                { inlineData: { data: base64Seed, mimeType: 'image/png' } },
                { text: `USE THIS AS REFERENCE FOR CUP, TABLE, AND BACKGROUND BLUR: ${prompt}` }
            ];

            const result = await model.generateContent(contents);
            const response = await result.response;

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    await supabase.from('menu_items').update({ image_url: base64Image }).eq('id', item.id);
                    console.log(`✅ ${item.name} updated.`);
                }
            }
        } catch (err) {
            console.error(`❌ Error on ${item.name}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 4000));
    }
    console.log("🏁 All cold drinks updated with Base64 and Jordan Valley aesthetic.");
}

finalAestheticFix();
